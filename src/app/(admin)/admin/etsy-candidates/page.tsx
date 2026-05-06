import { listCandidates } from "@/lib/etsy-outreach/candidates";
import { listPreviewsByCandidateIds } from "@/lib/etsy-outreach/pages";
import { previewMetrics, topPreviewsByViews } from "@/lib/etsy-outreach/events";
import { CandidatesTable } from "./candidates-table";
import { MetricsCards } from "./metrics-cards";
import { TopPreviews } from "./top-previews";

export const dynamic = "force-dynamic";

export default async function EtsyCandidatesPage() {
  const candidates = await listCandidates();
  const previews = await listPreviewsByCandidateIds(candidates.map((c) => c.id));
  const previewByCandidate = new Map(
    previews.map((p) => [p.candidateId, p] as const),
  );
  const metrics = await previewMetrics();
  const top = await topPreviewsByViews(5);

  const rows = candidates.map((c) => {
    const preview = previewByCandidate.get(c.id);
    return {
      id: c.id,
      title: c.title,
      shopName: c.shopName,
      shopUrl: c.shopUrl,
      imageUrl: c.imageUrl,
      listingUrl: c.listingUrl,
      location: c.category,
      status: c.status,
      updatedAt: c.updatedAt.toISOString(),
      preview: preview
        ? {
            id: preview.id,
            token: preview.token,
            status: preview.status,
          }
        : null,
    };
  });

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="font-serif text-[clamp(2rem,2.4vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
          Etsy candidates
        </h1>
        <p className="mt-2 max-w-[58ch] text-[14px] text-ink-3">
          Review Etsy listings and generate Shopify-ready examples for outreach.
        </p>
      </header>

      <CandidatesTable rows={rows} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MetricsCards metrics={metrics} />
        <TopPreviews items={top} />
      </div>
    </section>
  );
}
