"use client";

import { Suspense } from "react";
import { OtpAuthFlow } from "@/components/app/otp-auth-flow";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// "download" and "unlock" are functionally identical now — both gate
// on auth and resolve via inline OTP — but the eyebrow copy still
// differs so the user understands what they're signing up *for*.
type Intent = "default" | "download" | "unlock";

const eyebrow: Record<Intent, string> = {
  default: "Claim your studio · N°01",
  download: "Download HD · N°01",
  unlock: "Unlock bonus · N°01",
};

const headline: Record<Intent, React.ReactNode> = {
  default: (
    <>
      Save &amp;{" "}
      <em className="not-italic font-serif italic text-terracotta-dark">
        download
      </em>{" "}
      your batch.
    </>
  ),
  download: (
    <>
      Download your shot in{" "}
      <em className="not-italic font-serif italic text-terracotta-dark">HD</em>
      .
    </>
  ),
  unlock: (
    <>
      Unlock your{" "}
      <em className="not-italic font-serif italic text-terracotta-dark">
        bonus
      </em>{" "}
      shot.
    </>
  ),
};

export function AuthModal({
  open,
  onOpenChange,
  intent = "default",
  onAuthSuccess,
  // Magic-link era prop. Retained in the signature so existing callers
  // don't break, but the OTP flow never enters a "pending" state — the
  // session lands in-place once verifyOtp resolves.
  onConfirmationPending: _ignored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: Intent;
  /** Legacy hook for the magic-link "check your inbox" path. Unused. */
  defaultTab?: "sign-up" | "sign-in";
  onAuthSuccess: () => void | Promise<void>;
  onConfirmationPending?: (email: string) => void | Promise<void>;
  /** Magic-link redirect target. Unused by OTP. */
  next?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface p-6 text-ink sm:max-w-md">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              {eyebrow[intent]}
            </p>
            <DialogTitle className="font-serif text-[clamp(1.375rem,2vw,1.625rem)] leading-[1.1] tracking-[-0.01em] text-ink">
              {headline[intent]}
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-[1.55] text-ink-3">
              Enter your email and we&apos;ll send a 6-digit code — no
              passwords, no email links.
            </DialogDescription>
          </div>

          <Suspense>
            <OtpAuthFlow
              surface={`auth_modal_${intent}`}
              onSuccess={async () => {
                await onAuthSuccess();
              }}
              eyebrow={null}
              description={null}
            />
          </Suspense>

          <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
            Private · never sold · cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
