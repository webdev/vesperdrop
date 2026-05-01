"use client";

export type StepId = "upload" | "scenes" | "develop";

export const STEPS: { id: StepId; n: string; t: string }[] = [
  { id: "upload", n: "1", t: "Upload product" },
  { id: "scenes", n: "2", t: "Pick scenes" },
  { id: "develop", n: "3", t: "Develop" },
];

export function WizardSteps({ current }: { current: StepId }) {
  const order = STEPS.map((s) => s.id);
  const currentIdx = order.indexOf(current);

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5 md:gap-5 md:px-10">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.id} className="flex items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                    active
                      ? "bg-zinc-900 text-white"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {done ? (
                    <svg
                      width="12"
                      height="12"
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
                  className={`hidden text-[13px] font-medium tracking-tight sm:inline ${
                    active
                      ? "text-zinc-900"
                      : done
                        ? "text-zinc-700"
                        : "text-zinc-400"
                  }`}
                >
                  {s.t}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <span aria-hidden className="h-px w-6 bg-zinc-200 md:w-10" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
