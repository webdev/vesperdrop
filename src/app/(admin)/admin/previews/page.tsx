import Link from "next/link";
import { sceneify } from "@/lib/sceneify/client";
import { listIgPreviews, countIgPreviews } from "@/lib/ig-previews/pages";
import { CreatePreviewWorkflow } from "./create-preview-workflow";
import { RecentPreviewsTable, type PreviewRow } from "./recent-previews-table";

export const dynamic = "force-dynamic";

export default async function AdminPreviewsPage() {
  const [recent, total, presets] = await Promise.all([
    listIgPreviews(8),
    countIgPreviews(),
    sceneify().listPublicPresets(),
  ]);

  const presetTitleBySlug = new Map<string, string>(
    presets.map((p) => [p.slug, p.name]),
  );

  const rows: PreviewRow[] = recent.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title ?? "Untitled preview",
    sourceCount: r.sourceImages.length,
    presetTitle: presetTitleBySlug.get(r.presetSlug) ?? r.presetSlug,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    firstSourceUrl: r.sourceImages[0]?.url ?? null,
    sources: r.sourceImages.map((s) => ({ url: s.url, name: s.name })),
    outputs: r.outputs.map((o) => ({
      url: o.url,
      presetTitle: presetTitleBySlug.get(o.presetSlug) ?? o.presetSlug,
      sourceIndex: o.sourceIndex,
      slotType: o.slotType,
    })),
    expectedOutputCount: r.expectedOutputCount,
    viewCount: r.viewCount,
    ctaClickCount: r.ctaClickCount,
    signupClickCount: r.signupClickCount,
    signupCount: r.signupCount,
  }));

  return (
    <section className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[clamp(2rem,2.4vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
            Create IG Lead Gen Preview
          </h1>
          <p className="mt-2 max-w-[64ch] text-[14px] text-ink-3">
            Upload product images, choose a preset, and generate a unique
            preview link for your leads.
          </p>
        </div>
        <Link
          href="#recent"
          className="rounded-full border border-line bg-paper px-4 py-2 text-[13px] text-ink-2 hover:bg-surface"
        >
          View all previews
        </Link>
      </header>

      <CreatePreviewWorkflow presets={presets} />

      <section id="recent" className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-[22px] tracking-[-0.01em]">
            Recent previews
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
            Showing {rows.length} of {total}
          </span>
        </div>
        <RecentPreviewsTable rows={rows} />
        <div className="flex justify-end">
          <Link
            href="#"
            aria-disabled
            className="cursor-default text-[13px] text-ink-4"
          >
            View all previews →
          </Link>
        </div>
      </section>
    </section>
  );
}
