import "server-only";

/**
 * FIFO concurrency gate with optional priority lanes. Caller awaits
 * `run(fn, priority?)`; at most `max` functions execute simultaneously,
 * the rest wait. Higher-priority waiters jump ahead of lower-priority
 * ones — useful when a single fal.ai-bound budget is shared between
 * end-user requests (high priority) and admin batch generation (low
 * priority): /try users see at most one active slot's wait, even if
 * a 700-generation outreach batch is queued behind them.
 *
 * Within a priority level, ordering is FIFO.
 *
 * Scope caveat: this is in-process. A single Lambda/instance enforces
 * the cap and priority correctly. Across multiple cold-running
 * instances each one has its own gate. For Vesperdrop's current
 * admin-batch + low-traffic /try mix that's fine — Sceneify's own
 * rate response is the second line of defence — but if we ever scale
 * wide we should swap this for a Redis/DB token bucket.
 */
export class ConcurrencyGate {
  private active = 0;
  private queue: Array<{ resume: () => void; priority: number }> = [];

  constructor(private max: number) {
    if (max < 1) throw new Error(`ConcurrencyGate max must be >= 1, got ${max}`);
  }

  get inFlight(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  private async acquire(priority = 0): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => {
      const entry = {
        resume: () => {
          this.active++;
          resolve();
        },
        priority,
      };
      // Insert in priority order: higher priority first, FIFO within
      // the same priority (use > so equal priorities push to the back).
      let i = 0;
      while (i < this.queue.length && this.queue[i].priority >= priority) i++;
      this.queue.splice(i, 0, entry);
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next.resume();
  }

  /**
   * Run `fn` under the gate. Set `priority > 0` to jump ahead of
   * default-priority waiters; `priority < 0` to defer behind them.
   * Default 0 (FIFO).
   */
  async run<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    await this.acquire(priority);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
