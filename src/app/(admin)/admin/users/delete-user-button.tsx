"use client";

import { useState, useTransition } from "react";
import { deleteUserAction } from "./actions";

export function DeleteUserButton({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    const ok = window.confirm(
      `Delete ${email}? This wipes the auth user, profile, all runs, generations, and packs. Cannot be undone.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteUserAction(userId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <span className="text-[10px] text-rose-700">{error}</span>
      ) : null}
    </div>
  );
}
