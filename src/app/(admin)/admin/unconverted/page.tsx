import Link from "next/link";
import { listUnconvertedRuns } from "@/lib/admin-unconverted";

export const dynamic = "force-dynamic";

const dtFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return dtFmt.format(new Date(iso));
}

export default async function UnconvertedPage() {
  const runs = await listUnconvertedRuns();

  const totals = runs.reduce(
    (acc, r) => {
      acc.runs += 1;
      acc.gens += r.totalGenerations;
      if (r.unlockAttempted) acc.unlockStarted += 1;
      if (r.unlockPaidAt) acc.unlockPaid += 1;
      return acc;
    },
    { runs: 0, gens: 0, unlockStarted: 0, unlockPaid: 0 },
  );

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-[clamp(2rem,2.4vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
          Unconverted
        </h1>
        <p className="max-w-[64ch] text-[14px] text-ink-3">
          Anonymous runs — visitors who generated photos through /try but never
          signed up. Click any row to see source upload + generated outputs.
          {totals.unlockPaid > 0 ? (
            <>
              {" "}
              <strong className="text-rose-700">
                {totals.unlockPaid} paid without signing up
              </strong>{" "}
              — recovery targets.
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          <span>
            Runs <span className="ml-2 text-ink">{totals.runs}</span>
          </span>
          <span>
            Generations <span className="ml-2 text-ink">{totals.gens}</span>
          </span>
          <span>
            Unlock started{" "}
            <span className="ml-2 text-ink">{totals.unlockStarted}</span>
          </span>
          <span>
            Unlock paid{" "}
            <span className="ml-2 text-ink">{totals.unlockPaid}</span>
          </span>
        </div>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-soft bg-paper p-8 text-center text-[14px] text-ink-3">
          No anonymous runs. Every batch was tied to a signed-up user.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line-soft bg-paper">
          <table className="min-w-full text-[13px]">
            <thead className="border-b border-line-soft bg-surface/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <tr>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Gens</th>
                <th className="px-4 py-3 text-right">OK</th>
                <th className="px-4 py-3 text-right">Fail</th>
                <th className="px-4 py-3">Presets</th>
                <th className="px-4 py-3">Unlock</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.runId}
                  className="border-b border-line-soft last:border-b-0 hover:bg-surface/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/unconverted/${r.runId}`}
                      className="block h-12 w-12 overflow-hidden rounded border border-line-soft bg-surface"
                    >
                      {r.sourcePreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.sourcePreviewUrl}
                          alt="preview"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/unconverted/${r.runId}`}
                      className="font-mono text-[11px] text-ink underline-offset-4 hover:underline"
                    >
                      {r.runId.slice(0, 8)}
                    </Link>
                    {r.runName ? (
                      <span className="ml-2 text-[12px] text-ink-3">
                        {r.runName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    {fmtDateTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {r.totalGenerations}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                    {r.succeeded || ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                    {r.failed || ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className="line-clamp-1 font-mono text-[11px] text-ink-3">
                      {r.presetIds.join(", ") || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {r.unlockPaidAt ? (
                      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-rose-800">
                        paid · no signup
                      </span>
                    ) : r.unlockCustomerEmail ? (
                      <span className="text-ink">
                        {r.unlockCustomerEmail}
                      </span>
                    ) : r.unlockAttempted ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
                        started
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
