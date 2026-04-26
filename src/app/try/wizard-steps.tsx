"use client";

export type StepId = "upload" | "style" | "scenes" | "develop";

export const STEPS: { id: StepId; n: string; t: string }[] = [
  { id: "upload", n: "I", t: "UPLOAD PRODUCT" },
  { id: "style", n: "II", t: "PICK STYLE" },
  { id: "scenes", n: "III", t: "PICK SCENES" },
  { id: "develop", n: "IV", t: "DEVELOP" },
];

export function WizardSteps({ current }: { current: StepId }) {
  const order = STEPS.map((s) => s.id);
  const currentIdx = order.indexOf(current);

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-paper)]/80">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 md:gap-6 md:px-12">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const tone = active
            ? "text-[var(--color-ink)]"
            : done
              ? "text-[var(--color-ink-2)]"
              : "text-[var(--color-ink-4)]";
          return (
            <div key={s.id} className="flex items-center gap-3 md:gap-4">
              <div className={`flex items-baseline gap-2 ${tone}`}>
                <span
                  className={`font-serif text-xl italic md:text-2xl ${
                    active ? "text-[var(--color-ember)]" : ""
                  }`}
                >
                  {s.n}.
                </span>
                <span className="hidden font-mono text-[10px] tracking-[0.18em] sm:inline md:text-[11px]">
                  {s.t}
                </span>
                {done ? (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-ember)]" />
                ) : null}
              </div>
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="h-px w-6 bg-[var(--color-line)] md:w-12"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
