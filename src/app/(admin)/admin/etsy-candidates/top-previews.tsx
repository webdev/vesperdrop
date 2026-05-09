import Link from "next/link";

type Item = {
  id: string;
  token: string;
  title: string;
  viewCount: number;
  ctaClickCount: number;
  signupCount: number;
};

export function TopPreviews({ items }: { items: Item[] }) {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        Top performing previews
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-line-soft">
        {items.length === 0 ? (
          <li className="py-3 text-[13px] text-ink-3">No previews yet.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <Link
                href={`/p/${item.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-1 max-w-[28ch] text-[13px] text-ink hover:underline"
              >
                {item.title}
              </Link>
              <div className="flex shrink-0 items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                <span>{item.viewCount} views</span>
                <span>{item.ctaClickCount} clicks</span>
                <span>{item.signupCount} signups</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
