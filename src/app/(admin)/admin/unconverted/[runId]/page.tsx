import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUnconvertedRunDetail,
  type UnconvertedGenerationDetail,
} from "@/lib/admin-unconverted";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return dtFmt.format(new Date(iso));
}

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-rose-50 text-rose-800 border-rose-200",
  running: "bg-amber-50 text-amber-800 border-amber-200",
  pending: "bg-surface text-ink-3 border-line-soft",
};

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </p>
      <p className="mt-1 text-[14px] text-ink">{value}</p>
    </div>
  );
}

function GenerationTile({ gen }: { gen: UnconvertedGenerationDetail }) {
  const url = gen.outputUrl ?? gen.rawUrl;
  const statusClass = STATUS_STYLES[gen.status] ?? STATUS_STYLES.pending;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-md border border-line-soft bg-surface">
        {url ? (
          <Image
            src={url}
            alt={gen.presetId ?? gen.id}
            fill
            sizes="(min-width: 1024px) 220px, 45vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-ink-3">
            no output
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusClass}`}
          >
            {gen.status}
          </span>
          {gen.watermarked ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
              watermark
            </span>
          ) : null}
          {gen.quality === "preview" ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
              preview
            </span>
          ) : null}
        </div>
        <p className="truncate text-[12px] text-ink-2">
          {gen.presetId ?? "—"}
          {gen.packRole ? ` · ${gen.packRole}` : ""}
        </p>
        <p className="font-mono text-[10px] text-ink-3">
          {fmtDateTime(gen.createdAt)}
        </p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
          >
            Open
          </a>
        ) : null}
        {gen.error ? (
          <p className="line-clamp-2 text-[11px] text-rose-700">{gen.error}</p>
        ) : null}
      </div>
    </div>
  );
}

function SourceTile({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-md border border-line-soft bg-surface">
        <Image
          src={url}
          alt="source"
          fill
          sizes="(min-width: 1024px) 220px, 45vw"
          className="object-contain"
          unoptimized
        />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
      >
        Open original
      </a>
    </div>
  );
}

export default async function UnconvertedRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const detail = await getUnconvertedRunDetail(runId);
  if (!detail) notFound();

  const { runName, createdAt, sources, generations, unlock, totals } = detail;

  return (
    <section className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin/unconverted"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          ← Unconverted
        </Link>
        <div>
          <h1 className="font-serif text-[clamp(1.75rem,2vw,2.25rem)] leading-[1.05] tracking-[-0.02em]">
            {runName ?? "Anonymous run"}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-ink-3">{detail.runId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-line-soft bg-paper p-5 md:grid-cols-4 lg:grid-cols-6">
          <StatBlock label="Created" value={fmtDateTime(createdAt)} />
          <StatBlock
            label="Generations"
            value={`${totals.generations} (${totals.succeeded} ok / ${totals.failed} fail)`}
          />
          <StatBlock label="Sources" value={String(sources.length)} />
          <StatBlock
            label="Unlock status"
            value={unlock?.status ?? "—"}
          />
          <StatBlock
            label="Unlock email"
            value={unlock?.customerEmail ?? "—"}
          />
          <StatBlock
            label="Paid at"
            value={fmtDateTime(unlock?.paidAt)}
          />
        </div>

        {unlock?.paidAt ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-800">
            <strong>Paid without signing up.</strong> Customer paid at{" "}
            {fmtDateTime(unlock.paidAt)} but never created an account. Consider
            reaching out to {unlock.customerEmail ?? "the Stripe customer"} to
            close the loop.
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Source{sources.length === 1 ? "" : "s"} ({sources.length})
          </p>
          {sources.length === 0 ? (
            <p className="text-[12px] text-ink-3">No source recorded.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {sources.map((url) => (
                <SourceTile key={url} url={url} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Outputs
          </p>
          {generations.length === 0 ? (
            <p className="text-[12px] text-ink-3">No generations recorded.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {generations.map((g) => (
                <GenerationTile key={g.id} gen={g} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
