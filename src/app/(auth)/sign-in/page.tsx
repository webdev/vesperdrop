import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Vesperdrop account.",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Sign in
      </p>
      <h1 className="mt-3 font-serif text-[clamp(1.875rem,3vw,2.25rem)] leading-[1.05] tracking-[-0.02em] text-ink">
        Welcome back.
      </h1>
      <p className="mb-7 mt-2 text-[14px] text-ink-3">
        Pick up where you left off.
      </p>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="mt-7 text-[14px] text-ink-3">
        No account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </>
  );
}
