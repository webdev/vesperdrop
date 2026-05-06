import "server-only";

/**
 * Simple FIFO concurrency gate. Caller awaits `run(fn)`; at most `max`
 * functions execute simultaneously, the rest queue and start as slots
 * free up. Used to keep Sceneify / fal.ai in-flight requests under
 * the provider's concurrency limit so we don't 502 the upstream.
 *
 * Scope caveat: this is in-process. A single Lambda/instance enforces
 * the cap correctly. Across multiple cold-running instances each one
 * has its own gate, so the global cap can briefly exceed `max`. For
 * Vesperdrop's current admin-batch + low-traffic /try mix that's fine
 * — Sceneify's own rate response is the second line of defence — but
 * if we ever scale wide we should swap this for a Redis/DB token
 * bucket.
 */
export class ConcurrencyGate {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {
    if (max < 1) throw new Error(`ConcurrencyGate max must be >= 1, got ${max}`);
  }

  get inFlight(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  private async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
