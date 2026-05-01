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
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-zinc-900">
        Create your account
      </h1>
      <p className="mt-2 mb-7 text-[14px] text-zinc-600">
        Get 1 free HD shot. No card required.
      </p>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="mt-6 text-[14px] text-zinc-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
