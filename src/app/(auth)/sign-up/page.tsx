import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create your Vesperdrop account and get 1 free HD lifestyle shot. No card required.",
  alternates: { canonical: "/sign-up" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Create account
      </p>
      <h1 className="mt-3 font-serif text-[clamp(1.875rem,3vw,2.25rem)] leading-[1.05] tracking-[-0.02em] text-ink">
        Develop your first batch.
      </h1>
      <p className="mb-7 mt-2 text-[14px] text-ink-3">
        Get 1 free HD shot. No card required.
      </p>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="mt-7 text-[14px] text-ink-3">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
