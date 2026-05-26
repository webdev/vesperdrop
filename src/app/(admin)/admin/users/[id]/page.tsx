import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserDetail, type GenerationDetail } from "@/lib/admin-users";

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

function GenerationTile({ gen }: { gen: GenerationDetail }) {
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

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { profile, auth, runs, totals } = detail;

  return (
    <section className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin/users"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          ← Users
        </Link>
        <div>
          <h1 className="font-serif text-[clamp(1.75rem,2vw,2.25rem)] leading-[1.05] tracking-[-0.02em]">
            {profile.email}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-ink-3">{profile.id}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-line-soft bg-paper p-5 md:grid-cols-4 lg:grid-cols-6">
          <StatBlock
            label="Plan"
            value={`${profile.plan} (${profile.planBillingInterval})`}
          />
          <StatBlock label="Quota balance" value={String(profile.quotaBalance)} />
          <StatBlock
            label="Renews"
            value={fmtDateTime(profile.planRenewsAt)}
          />
          <StatBlock
            label="Stripe customer"
            value={profile.stripeCustomerId ?? "—"}
          />
          <StatBlock label="Profile created" value={fmtDateTime(profile.createdAt)} />
          <StatBlock
            label="Last failed run"
            value={fmtDateTime(profile.lastFailedRunAt)}
          />
          {auth ? (
            <>
              <StatBlock label="Signed up" value={fmtDateTime(auth.signedUpAt)} />
              <StatBlock
                label="Last sign-in"
                value={fmtDateTime(auth.lastSignInAt)}
              />
              <StatBlock
                label="Email confirmed"
                value={fmtDateTime(auth.emailConfirmedAt)}
              />
              <StatBlock label="Provider" value={auth.provider ?? "—"} />
            </>
          ) : null}
          <StatBlock label="Runs" value={String(totals.runs)} />
          <StatBlock
            label="Generations"
            value={`${totals.generations} (${totals.succeeded} ok / ${totals.failed} fail)`}
          />
        </div>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-soft bg-paper p-8 text-center text-[14px] text-ink-3">
          No generations yet.
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {runs.map((bucket, idx) => (
            <article
              key={bucket.runId ?? `orphan-${idx}`}
              className="flex flex-col gap-5"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3">
                <div>
                  <h2 className="font-serif text-[20px] leading-tight">
                    {bucket.runName ?? (bucket.runId ? "Untitled run" : "Anonymous / orphan")}
                  </h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    {bucket.runId ? bucket.runId.slice(0, 8) : "no run_id"} ·{" "}
                    {fmtDateTime(bucket.runCreatedAt)} ·{" "}
                    {bucket.generations.length} gen
                    {bucket.generations.length === 1 ? "" : "s"}
                  </p>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    Source{bucket.sources.length === 1 ? "" : "s"} (
                    {bucket.sources.length})
                  </p>
                  {bucket.sources.length === 0 ? (
                    <p className="text-[12px] text-ink-3">No source recorded.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                      {bucket.sources.map((url) => (
                        <SourceTile key={url} url={url} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    Outputs
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {bucket.generations.map((g) => (
                      <GenerationTile key={g.id} gen={g} />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
