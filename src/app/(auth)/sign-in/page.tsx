import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export default function Page() {
  return (
    <>
      <h1 className="font-serif text-3xl mb-6">Sign in</h1>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="text-sm text-[var(--color-ink-3)] mt-4">
        No account? <Link href="/sign-up" className="underline">Create one</Link>
      </p>
    </>
  );
}
