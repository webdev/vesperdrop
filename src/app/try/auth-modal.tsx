"use client";

import { Suspense } from "react";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: Intent;
  defaultTab?: "sign-up" | "sign-in";
  onAuthSuccess: () => void | Promise<void>;
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
                <AuthForm mode="sign-up" onSuccess={onAuthSuccess} next="/app/library" />
              </Suspense>
            </TabsContent>
            <TabsContent value="sign-in">
              <Suspense>
                <AuthForm mode="sign-in" onSuccess={onAuthSuccess} next="/app/library" />
              </Suspense>
            </TabsContent>
          </Tabs>

          <p className="pt-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
            Private · never sold · cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
