"use client";

import { Container } from "@/components/ui/container";

export type StepId = "upload" | "scenes" | "develop";

export const STEPS: { id: StepId; n: string; t: string; short: string }[] = [
  { id: "upload", n: "1", t: "Upload product", short: "Product" },
  { id: "scenes", n: "2", t: "Pick scenes", short: "Scene" },
  { id: "develop", n: "3", t: "Develop", short: "Generate" },
];

export function WizardSteps({ current }: { current: StepId }) {
  const order = STEPS.map((s) => s.id);
  const currentIdx = order.indexOf(current);

  return (
    <div className="sticky top-0 z-30 border-b border-line-soft bg-paper/85 backdrop-blur-md">
      <Container width="app" className="flex items-center gap-3 py-2.5 md:gap-5 md:py-3.5">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.id} className="flex items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2 md:gap-2.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] tracking-[0.04em] md:h-6 md:w-6 md:text-[11px] ${
                    active
                      ? "bg-terracotta text-cream md:bg-ink"
                      : done
                        ? "bg-terracotta-wash text-terracotta-dark"
                        : "border border-line-soft bg-paper-soft text-ink-4"
                  }`}
                >
                  {done ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    s.n
                  )}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.12em] md:text-[11px] ${
                    active
                      ? "text-ink"
                      : done
                        ? "text-ink-3"
                        : "text-ink-4"
                  }`}
                >
                  <span className="md:hidden">{s.short}</span>
                  <span className="hidden md:inline">{s.t}</span>
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <span aria-hidden className="h-px w-4 bg-line-soft md:w-10" />
              ) : null}
            </div>
          );
        })}
      </Container>
    </div>
  );
}
