import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
import { PreviewCta, PreviewViewTracker } from "./preview-cta";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Your products on Shopify · Vesperdrop",
    robots: { index: false, follow: false },
    alternates: { canonical: `/etsy-preview/${token}` },
  };
}

export default async function EtsyPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await getPreviewByToken(token);
  if (!page || (page.status !== "completed" && page.status !== "partial")) {
    notFound();
  }

  // Server Components can't write cookies in Next 15+. View counting,
  // session-dedup, and the vd_etsy_ref attribution cookie are all set in
  // the public events route handler when the client posts `view` on mount
  // (PreviewViewTracker below).

  const snap = page.listingSnapshot;
  const greeting = snap.shopName
    ? `Hi ${snap.shopName}, this is what`
    : "Hi there, this is what";

  // Three slot URLs in fixed roles. We label them in the collage.
  const heroUrl = page.heroUrl;
  const lifestyleUrl = page.lifestyleUrl;
  const detailUrl = page.detailUrl;
  const beforeUrl = snap.imageUrl ?? page.sourceBlobUrl ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-line-soft py-5">
        <Container width="marketing" className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[20px] tracking-tight">
            Vesperdrop
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
            Private preview
          </span>
        </Container>
      </header>

      <main className="flex-1">
        <Container width="marketing">
          <PreviewViewTracker
            token={token}
            candidateId={page.candidateId}
            sellerName={snap.shopName}
            listingUrl={snap.listingUrl}
          />

          {/* ─── Hero ──────────────────────────────────────────── */}
          <section className="pt-20 pb-16 md:pt-28 md:pb-20">
            <div className="max-w-[20ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                Private preview
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Created for your Etsy listing
              </p>
            </div>
            <h1 className="mt-10 max-w-[18ch] font-serif text-[clamp(2.6rem,5.4vw,4.5rem)] leading-[1.02] tracking-[-0.025em] text-ink">
              {greeting}{" "}
              <span className="text-terracotta">your product</span> could look
              like on Shopify.
            </h1>
            <p className="mt-7 max-w-[52ch] text-[15px] leading-[1.55] text-ink-3">
              We created these examples privately, just for you, to help you
              see what your listings could look like as a premium brand.
            </p>
          </section>

          <div className="h-px w-full bg-line-soft" />

          {/* ─── Editorial transformation ─────────────────────── */}
          <section className="py-16 md:py-24">
            <p className="mb-10 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              The transformation
            </p>

            <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
              {/* Left — archival "before" card */}
              <aside className="md:sticky md:top-12">
                <div className="rounded-[28px] border border-line bg-cream/60 p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_18px_50px_-30px_rgba(40,30,20,0.18)]">
                  {beforeUrl ? (
                    <div className="overflow-hidden rounded-[18px]">
                      <Image
                        src={beforeUrl}
                        alt={snap.title}
                        width={260}
                        height={325}
                        className="aspect-[4/5] w-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
                    Etsy listing
                  </p>
                  <p className="mt-2 line-clamp-3 font-serif text-[14px] leading-[1.4] text-ink">
                    {snap.title}
                  </p>
                  {(snap.shopName || snap.category) ? (
                    <p className="mt-1.5 text-[11px] text-ink-3">
                      {snap.shopName ?? ""}
                      {snap.shopName && snap.category ? " · " : ""}
                      {snap.category ?? ""}
                    </p>
                  ) : null}
                  <Link
                    href={snap.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-[11px] text-ink-3 underline-offset-4 hover:text-ink hover:underline"
                  >
                    View original ↗
                  </Link>
                </div>
                <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">
                  Before
                </p>
              </aside>

              {/* Right — asymmetric editorial collage */}
              <div>
                <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
                  After · Vesperdrop campaign
                </p>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:grid-rows-[auto_auto]">
                  {/* Lifestyle hero — large, dominant */}
                  {lifestyleUrl ? (
                    <figure className="relative md:col-span-7 md:row-span-2">
                      <span className="absolute -top-3 left-4 z-10 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)]">
                        Lifestyle hero
                      </span>
                      <div className="overflow-hidden rounded-[24px] bg-cream shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_30px_60px_-40px_rgba(40,30,20,0.35)]">
                        <Image
                          src={lifestyleUrl}
                          alt="Lifestyle hero"
                          width={900}
                          height={1200}
                          className="aspect-[3/4] w-full object-cover"
                          unoptimized
                        />
                      </div>
                    </figure>
                  ) : null}

                  {/* Hero — Shopify-ready clean shot */}
                  {heroUrl ? (
                    <figure className="relative md:col-span-5 md:translate-y-6">
                      <span className="absolute -top-3 right-4 z-10 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)]">
                        Shopify ready
                      </span>
                      <div className="overflow-hidden rounded-[24px] bg-cream shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_22px_50px_-32px_rgba(40,30,20,0.3)]">
                        <Image
                          src={heroUrl}
                          alt="Shopify hero"
                          width={700}
                          height={700}
                          className="aspect-square w-full object-cover"
                          unoptimized
                        />
                      </div>
                    </figure>
                  ) : null}

                  {/* Detail — texture / closeup */}
                  {detailUrl ? (
                    <figure className="relative md:col-span-5 md:-translate-y-2">
                      <span className="absolute -top-3 right-4 z-10 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)]">
                        Texture detail
                      </span>
                      <div className="overflow-hidden rounded-[24px] bg-cream shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_22px_50px_-32px_rgba(40,30,20,0.3)]">
                        <Image
                          src={detailUrl}
                          alt="Texture detail"
                          width={700}
                          height={500}
                          className="aspect-[7/5] w-full object-cover"
                          unoptimized
                        />
                      </div>
                    </figure>
                  ) : null}
                </div>

                {/* Quiet caption row */}
                <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4 md:grid-cols-3">
                  <span>Conversion-focused imagery</span>
                  <span>Mobile storefront ready</span>
                  <span>Social campaign assets</span>
                </div>
              </div>
            </div>
          </section>

          <div className="h-px w-full bg-line-soft" />

          {/* ─── Benefits — editorial proof points ────────────── */}
          <section className="py-16 md:py-20">
            <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 md:grid-cols-4 md:divide-x md:divide-line-soft">
              {[
                ["01", "Shopify ready", "Sized and styled for product detail pages from day one."],
                ["02", "Lifestyle focused", "Imagery that helps customers picture themselves wearing it."],
                ["03", "Higher conversions", "Editorial-grade visuals consistently outperform flat lays."],
                ["04", "Save time & money", "No photoshoot. No models. Minutes instead of days."],
              ].map(([num, title, body]) => (
                <div key={title} className="px-0 first:pl-0 md:px-8 md:first:pl-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
                    {num}
                  </p>
                  <p className="mt-3 font-serif text-[20px] leading-[1.15] tracking-[-0.01em] text-ink">
                    {title}
                  </p>
                  <p className="mt-2 max-w-[24ch] text-[13px] leading-[1.5] text-ink-3">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── CTA — premium reveal card ────────────────────── */}
          <section className="pb-20 md:pb-28">
            <PreviewCta
              token={token}
              candidateId={page.candidateId}
              sellerName={snap.shopName}
              listingUrl={snap.listingUrl}
            />

            {/* Trust row */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
              <span>Built for modern Shopify brands</span>
              <span aria-hidden>·</span>
              <span>Used by independent sellers</span>
              <span aria-hidden>·</span>
              <span>No photoshoot required</span>
            </div>
          </section>
        </Container>
      </main>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-line-soft py-10">
        <Container
          width="marketing"
          className="flex flex-col items-center gap-2 text-center"
        >
          <p className="font-serif text-[14px] italic leading-[1.5] text-ink-3">
            This preview was created privately for your listing using
            Vesperdrop.
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
            Vesperdrop · Private campaign reveal
          </p>
        </Container>
      </footer>
    </div>
  );
}
