"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  exact?: boolean;
  matchPrefixes?: string[];
  children: React.ReactNode;
};

export function NavLink({ href, exact, matchPrefixes, children }: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const matchesHref = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  const matchesExtra =
    matchPrefixes?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false;
  const isActive = matchesHref || matchesExtra;

  return (
    <Link
      href={href}
      className={cn(
        "relative py-1 transition-colors hover:text-ink",
        isActive
          ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-terracotta"
          : "text-ink-3",
      )}
    >
      {children}
    </Link>
  );
}
