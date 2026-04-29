"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="space-y-4 py-12">
      <h2 className="font-serif text-2xl">Something went wrong</h2>
      <p className="text-sm text-[var(--color-ink-3)]">{error.message}</p>
      <button onClick={reset} className="underline">
        Try again
      </button>
    </div>
  );
}
