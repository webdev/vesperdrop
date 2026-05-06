import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Etsy candidates", href: "/admin/etsy-candidates", active: true },
  { label: "Generations", href: "#", active: false },
  { label: "Library", href: "#", active: false },
  { label: "Batches", href: "#", active: false },
  { label: "Discover", href: "#", active: false },
  { label: "Settings", href: "#", active: false },
] as const;

export function AdminSidebar() {
  return (
    <aside className="md:sticky md:top-20 md:self-start">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
        Admin
      </p>
      <nav aria-label="Admin sections" className="flex flex-col gap-1">
        {ITEMS.map((item) =>
          item.active ? (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md bg-surface px-3 py-2 text-[14px] font-medium text-ink"
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              aria-disabled="true"
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-[14px] text-ink-4",
                "cursor-default select-none",
              )}
            >
              <span>{item.label}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-4">
                Soon
              </span>
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}
