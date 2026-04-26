import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export default function Page() {
  return (
    <>
      <h1 className="font-serif text-3xl mb-6">Create account</h1>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="text-sm text-[var(--color-ink-3)] mt-4">
        Have an account? <Link href="/sign-in" className="underline">Sign in</Link>
      </p>
    </>
  );
}
