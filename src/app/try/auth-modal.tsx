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
  default: "BATCH READY · N°01",
  download: "DOWNLOAD HD · N°01",
  unlock: "UNLOCK BONUS · N°01",
};

const headline: Record<Intent, React.ReactNode> = {
  default: (
    <>
      Save &amp; <em className="italic">download</em> your batch.
    </>
  ),
  download: (
    <>
      Download your shot in <em className="italic">HD</em>.
    </>
  ),
  unlock: (
    <>
      Unlock your <em className="italic">bonus</em> shot.
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
      <DialogContent className="sm:max-w-md bg-[var(--color-paper)] text-[var(--color-ink)] p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-3)]">
              {eyebrow[intent]}
            </p>
            <DialogTitle className="font-serif text-2xl leading-tight text-[var(--color-ink)]">
              {headline[intent]}
            </DialogTitle>
            <DialogDescription className="font-serif text-sm text-[var(--color-ink-2)]">
              Free · 1 HD credit on us · no card required.
            </DialogDescription>
          </div>

          <Tabs defaultValue={defaultTab} className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger
                value="sign-up"
                className="font-mono text-[10px] tracking-[0.2em] uppercase"
              >
                Create account
              </TabsTrigger>
              <TabsTrigger
                value="sign-in"
                className="font-mono text-[10px] tracking-[0.2em] uppercase"
              >
                Sign in
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sign-up">
              <Suspense>
                <AuthForm mode="sign-up" onSuccess={onAuthSuccess} next="/app/history" />
              </Suspense>
            </TabsContent>
            <TabsContent value="sign-in">
              <Suspense>
                <AuthForm mode="sign-in" onSuccess={onAuthSuccess} next="/app/history" />
              </Suspense>
            </TabsContent>
          </Tabs>

          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--color-ink-4)] text-center pt-2">
            Private · never sold · cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
