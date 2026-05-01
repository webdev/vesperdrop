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
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-zinc-900">
        Sign in
      </h1>
      <p className="mt-2 mb-7 text-[14px] text-zinc-600">
        Welcome back.
      </p>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="mt-6 text-[14px] text-zinc-600">
        No account?{" "}
        <Link href="/sign-up" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
