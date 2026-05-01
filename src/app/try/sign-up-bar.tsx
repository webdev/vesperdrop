"use client";

import { useEffect } from "react";

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white"
      style={{ boxShadow: "0 -4px 24px rgba(27,25,21,0.10)" }}
      role="region"
      aria-label="Save your batch"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:px-12 md:py-6">
        <div className="flex-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase">
            BATCH READY · N°01
          </p>
          <h2 className="mt-1.5 text-2xl  leading-tight text-zinc-900 md:text-3xl">
            Save &amp; download your <span className="italic">batch</span>.
          </h2>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.16em] text-orange-500 uppercase">
            These shots vanish when you close this tab
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-4">
          <button
            type="button"
            onClick={() => {
              track("try_signup_clicked", { intent: "default" });
              onSignUpClick();
            }}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] hover:bg-[#a83c18] md:px-8 md:py-4"
          >
            Create your account →
          </button>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase underline-offset-4 hover:text-orange-500 hover:underline"
          >
            ← Try with another product
          </button>
        </div>
      </div>
      <div className="border-t border-zinc-200 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-2 text-center font-mono text-[10px] tracking-[0.18em] text-zinc-400 uppercase md:px-12">
          FREE · 1 HD CREDIT · NO CARD · YOUR FIRST SHOT IS ON US
        </div>
      </div>
    </div>
  );
}
