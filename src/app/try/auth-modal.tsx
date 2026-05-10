"use client";

import { Suspense, useState } from "react";
import { AuthForm } from "@/components/app/auth-form";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Intent = "default" | "download" | "unlock";

const eyebrow: Record<Intent, string> = {
  default: "Batch ready · N°01",
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
  defaultTab = "sign-up",
  onAuthSuccess,
  onConfirmationPending,
  // /app/claim is the post-confirm landing page: it shows the user's
  // watermarked previews with Download buttons inline and persists the
  // batch to the library in the background. /app/library still mounts
  // <ClaimHandler /> as a fallback for any in-flight tabs whose modal
  // was opened before this default changed.
  next = "/app/claim",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: Intent;
  defaultTab?: "sign-up" | "sign-in";
  onAuthSuccess: () => void | Promise<void>;
  /**
   * Bubbles up from AuthForm when sign-up succeeded but Supabase requires
   * email confirmation (signUp returned no session). The parent uses this
   * to persist the pending try-intent server-side keyed by email so the
   * flow survives the user opening the confirmation email on a different
   * device.
   */
  onConfirmationPending?: (email: string) => void | Promise<void>;
  next?: string;
}) {
  // Pending email-confirmation state. When the user finishes the sign-up
  // form but Supabase requires email confirmation, we keep the modal open
  // and swap the form for a "check your email" panel rather than
  // redirecting — generation is auth-gated and would 401 pre-confirmation.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Clearing pendingEmail in onOpenChange (rather than a useEffect on
  // `open`) keeps the side effect at the event source and satisfies the
  // react-hooks/set-state-in-effect rule.
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPendingEmail(null);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface p-6 text-ink sm:max-w-md">
        {pendingEmail ? (
          <ConfirmEmailPanel email={pendingEmail} intent={intent} />
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                {eyebrow[intent]}
              </p>
              <DialogTitle className="font-serif text-[clamp(1.375rem,2vw,1.625rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                {headline[intent]}
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-[1.55] text-ink-3">
                Free · 1 HD credit on us · no card required.
              </DialogDescription>
            </div>

            <Tabs defaultValue={defaultTab} className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger
                  value="sign-up"
                  className="font-mono text-[11px] uppercase tracking-[0.12em]"
                >
                  Create account
                </TabsTrigger>
                <TabsTrigger
                  value="sign-in"
                  className="font-mono text-[11px] uppercase tracking-[0.12em]"
                >
                  Sign in
                </TabsTrigger>
              </TabsList>
              <TabsContent value="sign-up">
                <Suspense>
                  <AuthForm
                    mode="sign-up"
                    onSuccess={onAuthSuccess}
                    onConfirmationPending={(email) => {
                      setPendingEmail(email);
                      // Fire-and-forget — parent persists the try-intent
                      // server-side so cross-device confirmation works.
                      // Errors are swallowed; same-device users still
                      // hydrate from localStorage.
                      void onConfirmationPending?.(email);
                    }}
                    next={next}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="sign-in">
                <Suspense>
                  <AuthForm mode="sign-in" onSuccess={onAuthSuccess} next={next} />
                </Suspense>
              </TabsContent>
            </Tabs>

            <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
              Private · never sold · cancel anytime
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmEmailPanel({
  email,
  intent,
}: {
  email: string;
  intent: Intent;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          {eyebrow[intent]}
        </p>
        <DialogTitle className="font-serif text-[clamp(1.375rem,2vw,1.625rem)] leading-[1.1] tracking-[-0.01em] text-ink">
          Check your{" "}
          <em className="not-italic font-serif italic text-terracotta-dark">
            inbox
          </em>
          .
        </DialogTitle>
        <DialogDescription className="text-[14px] leading-[1.55] text-ink-3">
          We sent a confirmation link to{" "}
          <span className="font-medium text-ink">{email}</span>. Click it and
          we&apos;ll start developing your batch.
        </DialogDescription>
      </div>

      <div className="rounded-md border border-line-soft bg-paper-soft px-4 py-3 text-[13px] leading-[1.5] text-ink-2">
        Your photo and scenes are saved on this device. Open the link from this
        browser and you&apos;ll land back in the studio with everything ready.
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
        Don&apos;t see it? Check spam · the link expires in 1 hour
      </p>
    </div>
  );
}
