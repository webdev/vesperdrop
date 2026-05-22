"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

type Props = {
  isSignedIn: boolean;
  credits: number | null;
  isAdmin: boolean;
  firstName: string | null;
  email: string;
};

export function MobileNavSheet({
  isSignedIn,
  credits,
  isAdmin,
  firstName,
  email,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => setOpen(open)}>
      <DialogPrimitive.Trigger
        className="flex h-11 w-11 items-center justify-center text-ink"
        aria-label="Open navigation"
        data-testid="hamburger-button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={20}
          height={20}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <line x1="3" y1="6" x2="17" y2="6" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="14" x2="17" y2="14" />
        </svg>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
        />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col bg-paper shadow-xl">
          {/* Sheet header */}
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <span className="font-serif text-[18px] font-medium tracking-tight text-ink">
              Vesperdrop
            </span>
            <DialogPrimitive.Close
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink"
              aria-label="Close navigation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <line x1="3" y1="3" x2="13" y2="13" />
                <line x1="13" y1="3" x2="3" y2="13" />
              </svg>
            </DialogPrimitive.Close>
          </div>

          {/* Navigation links */}
          <nav
            className="flex flex-col px-4 py-4"
            aria-label="Mobile navigation"
            data-testid="sheet-nav"
          >
            {isSignedIn ? (
              <>
                <SheetLink href="/app/library">Library</SheetLink>
                <SheetLink href="/app">Styles</SheetLink>
                <SheetLink href="/account">Account</SheetLink>
                <SheetLink href="/discover">Discover</SheetLink>
                <SheetLink href="/pricing">Pricing</SheetLink>
                {isAdmin ? (
                  <SheetLink href="/admin/etsy-candidates">Admin</SheetLink>
                ) : null}
              </>
            ) : (
              <>
                <Link
                  href="/try"
                  className="mb-4 inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
                >
                  First photo free →
                </Link>
                <SheetLink href="/discover">Discover</SheetLink>
                <SheetLink href="/pricing">Pricing</SheetLink>
                <SheetLink href="/#how">How it works</SheetLink>
                <SheetLink href="/sign-in">Sign in</SheetLink>
              </>
            )}
          </nav>

          {/* Footer — authed users only */}
          {isSignedIn ? (
            <div
              className="mt-auto border-t border-line-soft px-5 py-5"
              data-testid="sheet-footer"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                Photos:{" "}
                <span className="text-ink">
                  {isAdmin ? "∞" : (credits ?? 0)}
                </span>
                {" · "}
                {isAdmin ? "Admin" : (firstName ?? email)}
              </p>
              <form action="/api/auth/sign-out" method="post" className="mt-4">
                <button
                  type="submit"
                  className="py-1 text-[14px] text-ink-3 transition-colors hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SheetLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block py-3 text-[16px] text-ink-2 transition-colors hover:text-ink"
    >
      {children}
    </Link>
  );
}
