"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  href: string;
};

const ITEMS: Item[] = [
  { label: "Users", href: "/admin/users" },
  { label: "Etsy", href: "/admin/etsy-candidates" },
  { label: "Previews", href: "/admin/previews" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="md:sticky md:top-20 md:self-start">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
        Admin
      </p>
      <nav aria-label="Admin sections" className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const isCurrent = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-[14px]",
                isCurrent
                  ? "bg-surface font-medium text-ink"
                  : "text-ink-3 hover:bg-surface/60 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
