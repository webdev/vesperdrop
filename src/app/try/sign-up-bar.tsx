"use client";

import { useEffect } from "react";

import { Container } from "@/components/ui/container";
import { track } from "@/lib/analytics";

export function SignUpBar({
  onReset,
  onSignUpClick,
}: {
  onReset: () => void;
  onSignUpClick: () => void;
}) {
  useEffect(() => {
    track("try_signup_gate_seen");
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-surface shadow-[0_-4px_24px_rgba(43,32,24,0.08)]"
      role="region"
      aria-label="Save your batch"
    >
      <Container width="app" className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:py-6">
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Batch ready · N°01
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.1] tracking-[-0.01em] text-ink">
            Save &amp; download your{" "}
            <em className="not-italic font-serif italic text-terracotta-dark">
              batch
            </em>
            .
          </h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-terracotta">
            These shots vanish when you close this tab
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-4">
          <button
            type="button"
            onClick={() => {
              track("try_signup_clicked", { intent: "default" });
              onSignUpClick();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark md:px-8"
          >
            Create your account <span aria-hidden>→</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            ← Try with another product
          </button>
        </div>
      </Container>
      <div className="border-t border-line-soft bg-paper-soft">
        <Container width="app" className="py-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          Free · 1 HD credit · no card · your first shot is on us
        </Container>
      </div>
    </div>
  );
}
