import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { FaceSafeImage } from "@/components/ui/face-safe-image";
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
    title: "Your products on Etsy · Vesperdrop",
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
      <header className="border-b border-line-soft py-4">
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

          {/* ─── Hero — compact, leaves room for the transformation above the fold ─── */}
          <section className="pt-8 pb-6 md:pt-12 md:pb-8">
            <div className="max-w-[20ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                Private preview
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Created for your Etsy listing
              </p>
            </div>
            <h1 className="mt-5 max-w-[18ch] font-serif text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.025em] text-ink">
              {greeting}{" "}
              <span className="text-terracotta">your product</span> could look
              like on Etsy.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[14.5px] leading-[1.5] text-ink-3">
              We created these examples privately, just for you, to help you
              see what your listings could look like as a premium brand.
            </p>
          </section>

          <div className="h-px w-full bg-line-soft" />

          {/* ─── Editorial transformation ─────────────────────── */}
          <section className="relative pt-6 pb-14 md:pt-8 md:pb-20">
            {/* Faint staged backdrop — the transformation rests on its own surface */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[-2vw] inset-y-2 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_top,_oklch(0.96_0.013_75)_0%,_transparent_70%)]"
            />
            <div className="mb-5 flex items-baseline justify-between gap-4 md:mb-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                The transformation
              </p>
              <p className="hidden font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3 sm:block">
                Generated from your real Etsy listing
              </p>
            </div>

            <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-[240px_minmax(0,1fr)] md:items-start md:gap-x-12">
              {/* Left — archival "before" card (intentionally raw) */}
              <aside className="md:sticky md:top-12 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
                <div className="relative rounded-[28px] border border-[oklch(0.78_0.02_70)]/60 bg-cream/80 p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_22px_38px_-24px_rgba(60,45,25,0.28)]">
                  <span className="absolute -top-2.5 left-5 rounded-full border border-line-soft bg-paper px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-ink-3">
                    Original Etsy listing
                  </span>
                  {beforeUrl ? (
                    <div className="overflow-hidden rounded-[18px] bg-[oklch(0.92_0.012_70)]">
                      <Image
                        src={beforeUrl}
                        alt={snap.title}
                        width={260}
                        height={325}
                        className="aspect-[4/5] w-full object-cover saturate-[0.85] contrast-[0.97]"
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
                    {snap.shopName ?? "Etsy seller"}
                  </p>
                  <p className="mt-2 line-clamp-3 font-serif text-[14px] leading-[1.4] text-ink">
                    {snap.title}
                  </p>
                  {snap.category ? (
                    <p className="mt-1.5 text-[11px] text-ink-3">
                      {snap.category}
                    </p>
                  ) : null}
                  <Link
                    href={snap.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-[11px] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    View original ↗
                  </Link>
                </div>

                {/* Editorial metadata — exclusivity */}
                <ul className="mt-6 space-y-2.5 px-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-4">
                  {[
                    "Generated privately",
                    "Prepared for your listing",
                    "AI campaign preview",
                    "Created today",
                    "Ready for Etsy",
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <span className="h-px w-6 bg-line-soft" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Right — asymmetric editorial collage */}
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <span
                    aria-hidden
                    className="hidden h-px flex-1 bg-line-soft md:block"
                  />
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3">
                    After · Vesperdrop campaign
                  </p>
                  <span
                    aria-hidden
                    className="font-mono text-[10px] text-ink-3"
                  >
                    →
                  </span>
                  <span
                    aria-hidden
                    className="hidden h-px flex-1 bg-line-soft md:block"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:grid-rows-[auto_auto]">
                  {/* Lifestyle hero — dominant, with stronger shadow */}
                  {lifestyleUrl ? (
                    <figure className="group relative motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:[animation-delay:120ms] md:col-span-7 md:row-span-2 md:scale-[1.08] md:origin-top-left">
                      <span className="absolute -top-3 left-4 z-10 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)]">
                        Lifestyle hero
                      </span>
                      <div className="overflow-hidden rounded-[24px] bg-cream shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_44px_80px_-44px_rgba(40,30,20,0.45)] transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-1">
                        <FaceSafeImage
                          src={lifestyleUrl}
                          alt="Lifestyle hero"
                          width={900}
                          height={1200}
                          focalPoint={page.lifestyleFocalPoint ?? undefined}
                          faceBox={page.lifestyleFaceBox ?? undefined}
                          className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                          unoptimized
                        />
                      </div>
                    </figure>
                  ) : null}

                  {/* Hero — Etsy-ready clean shot */}
                  {heroUrl ? (
                    <figure className="group relative motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:[animation-delay:240ms] md:col-span-5 md:translate-y-6">
                      <span className="absolute -top-3 right-4 z-10 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)]">
                        Etsy ready
                      </span>
                      <div className="overflow-hidden rounded-[24px] bg-cream shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_22px_50px_-32px_rgba(40,30,20,0.3)] transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-1">
                        <FaceSafeImage
                          src={heroUrl}
                          alt="Etsy hero"
                          width={700}
                          height={700}
                          focalPoint={page.heroFocalPoint ?? undefined}
                          faceBox={page.heroFaceBox ?? undefined}
                          className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                          unoptimized
                        />
                      </div>
                    </figure>
                  ) : null}

                  {/* Detail — texture / closeup */}
                  {detailUrl ? (
                    <figure className="group relative motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:[animation-delay:360ms] md:col-span-5 md:-translate-y-2">
                      <span className="absolute -top-3 right-4 z-10 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)]">
                        Texture detail
                      </span>
                      <div className="overflow-hidden rounded-[24px] bg-cream shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_22px_50px_-32px_rgba(40,30,20,0.3)] transition-transform duration-500 ease-out will-change-transform group-hover:-translate-y-1">
                        <FaceSafeImage
                          src={detailUrl}
                          alt="Texture detail"
                          width={700}
                          height={500}
                          focalPoint={page.detailFocalPoint ?? undefined}
                          faceBox={page.detailFaceBox ?? undefined}
                          className="aspect-[7/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                          unoptimized
                        />
                      </div>
                    </figure>
                  ) : null}
                </div>

                {/* Quiet caption row */}
                <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-4 md:grid-cols-4">
                  <span>Lifestyle hero</span>
                  <span>Mobile-ready</span>
                  <span>Editorial crop</span>
                  <span>High conversion</span>
                </div>
              </div>
            </div>
          </section>

          <div className="h-px w-full bg-line-soft" />

          {/* ─── Benefits — lightweight credibility strip ─────── */}
          <section className="py-10 md:py-14">
            <div className="grid grid-cols-1 gap-y-7 sm:grid-cols-2 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-line-soft/60">
              {[
                ["01", "Etsy ready", "Sized for product pages from day one."],
                ["02", "Lifestyle focused", "Helps customers picture themselves wearing it."],
                ["03", "Higher conversions", "Editorial visuals outperform flat lays."],
                ["04", "Save time & money", "No photoshoot. Minutes instead of days."],
              ].map(([num, title, body]) => (
                <div
                  key={title}
                  className="px-0 first:pl-0 md:px-8 md:first:pl-0"
                >
                  <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">
                    {num}
                  </p>
                  <p className="mt-2.5 font-serif text-[19px] leading-[1.12] tracking-[-0.012em] text-ink">
                    {title}
                  </p>
                  <p className="mt-1.5 max-w-[22ch] text-[12.5px] leading-[1.5] text-ink-3">
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

            {/* Social proof — understated avatar stack */}
            <div className="mx-auto mt-10 flex max-w-[640px] flex-col items-center gap-3">
              <div className="flex -space-x-2" aria-hidden>
                {[
                  "oklch(0.78 0.04 70)",
                  "oklch(0.86 0.025 80)",
                  "oklch(0.74 0.05 50)",
                  "oklch(0.82 0.03 90)",
                  "oklch(0.7 0.04 40)",
                ].map((c, i) => (
                  <span
                    key={i}
                    style={{ background: c }}
                    className="h-7 w-7 rounded-full border-2 border-paper shadow-[0_2px_6px_-2px_rgba(40,30,20,0.25)]"
                  />
                ))}
              </div>
              <p className="text-center font-serif text-[13px] italic leading-[1.5] text-ink-3">
                Join independent Etsy and Shopify sellers using Vesperdrop to
                refine their storefronts.
              </p>
            </div>

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
              <span>Built for modern Etsy brands</span>
              <span aria-hidden>·</span>
              <span>Used by independent sellers</span>
              <span aria-hidden>·</span>
              <span>No photoshoot required</span>
            </div>
          </section>
        </Container>
      </main>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="py-12 md:py-16">
        <Container width="marketing">
          <div className="mx-auto h-px w-full max-w-[280px] bg-line-soft/70" />
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <p className="font-serif text-[14px] italic leading-[1.55] text-ink-3">
              This preview was created privately for your Etsy listing using
              Vesperdrop.
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">
              Vesperdrop · Private campaign reveal
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
