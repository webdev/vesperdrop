import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { FaceSafeImage } from "@/components/ui/face-safe-image";
import {
  getPreviewPageByToken,
  type PreviewGeneratedImage,
  type PreviewPageData,
} from "@/lib/preview-pages/loader";
import { PreviewCta, PreviewViewTracker } from "./preview-cta";
import { CampaignGallery } from "./preview-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Your products online · Vesperdrop",
    robots: { index: false, follow: false },
    alternates: { canonical: `/p/${token}` },
  };
}

export default async function EtsyPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPreviewPageByToken(token);
  if (!data) notFound();

  if (
    data.sourceType === "etsy_preview" &&
    data.status !== "completed" &&
    data.status !== "partial"
  ) {
    notFound();
  }

  const allGenerated = data.generatedImages.filter(
    (g) => typeof g.url === "string" && g.url.length > 0,
  );

  const { hero, supporting } = pickHeroPair(allGenerated);
  const heroUrls = new Set<string>();
  if (hero) heroUrls.add(hero.url);
  if (supporting) heroUrls.add(supporting.url);

  const greeting = data.sellerName
    ? `Hi ${data.sellerName}, this is what`
    : "Hi there, this is what";

  const collagePending =
    data.status === "pending" ||
    data.status === "queued" ||
    data.status === "generating";

  const sourceCount = data.originalImages.length;
  const isMulti = sourceCount > 1;
  const subjectWord = isMulti ? "your products" : "your product";

  const groupedBySource = new Map<number, PreviewGeneratedImage[]>();
  for (const g of allGenerated) {
    const list = groupedBySource.get(g.sourceIndex) ?? [];
    list.push(g);
    groupedBySource.set(g.sourceIndex, list);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
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
          <PreviewViewTracker data={data} />

          <section className="relative pt-5 pb-6 md:pt-8 md:pb-9">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[-2vw] inset-y-2 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_top,_oklch(0.96_0.013_75)_0%,_transparent_70%)]"
            />
            <div className="grid grid-cols-1 gap-x-8 gap-y-7 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)] md:items-center md:gap-x-12">
              <div>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                  Private preview
                </p>
                <h1 className="max-w-[16ch] font-serif text-[clamp(2.4rem,5vw,4rem)] leading-[1.0] tracking-[-0.03em] text-ink">
                  {greeting}{" "}
                  <span className="text-terracotta">{subjectWord}</span> could
                  look like online.
                </h1>
                <p className="mt-4 max-w-[48ch] text-[14.5px] leading-[1.55] text-ink-3">
                  We prepared these concepts privately to show how your
                  products could feel as a premium brand.
                </p>
              </div>
              <CinematicHero
                hero={hero}
                supporting={supporting}
                pending={collagePending}
                status={data.status}
              />
            </div>
          </section>

          <div className="flex flex-col items-center gap-3 py-10 md:py-14">
            <span className="block h-px w-full max-w-[100px] bg-line-soft" />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              Campaign preview
            </p>
          </div>

          <CampaignGallery
            originals={data.originalImages}
            generatedBySource={groupedBySource}
            excludeUrls={heroUrls}
            isMulti={isMulti}
          />

          <SectionDivider />

          <HowWeGeneratedSection />

          <SectionDivider eyebrow="What you get" />

          <BenefitsRow />

          <SectionDivider eyebrow="Make it yours" />

          <section className="relative pt-2 pb-10 md:pt-4 md:pb-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[-2vw] inset-y-2 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_top,_oklch(0.96_0.013_75)_0%,_transparent_70%)]"
            />
            <PreviewCta data={data} />

            <div className="mx-auto mt-7 flex max-w-[640px] flex-col items-center gap-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
                Used by independent brands
              </p>
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
                Join independent sellers using Vesperdrop to refine their
                storefronts.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
              <span>7-day free trial</span>
              <span aria-hidden>·</span>
              <span>Cancel anytime</span>
              <span aria-hidden>·</span>
              <span>No credit card required</span>
            </div>
          </section>

          <AboutThisPreviewSection />
        </Container>
      </main>

      <footer className="py-7 md:py-10">
        <Container width="marketing">
          <div className="mx-auto h-px w-full max-w-[280px] bg-line-soft/70" />
          <div className="mt-6 flex flex-col items-center gap-1.5 text-center">
            <p className="font-serif text-[14px] italic leading-[1.55] text-ink-3">
              This preview was created privately for your product using
              Vesperdrop.
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">
              Vesperdrop · Private campaign preview
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}

function pickHeroPair(images: PreviewGeneratedImage[]): {
  hero: PreviewGeneratedImage | null;
  supporting: PreviewGeneratedImage | null;
} {
  if (images.length === 0) return { hero: null, supporting: null };
  const score = (img: PreviewGeneratedImage): number => {
    const label = (img.label ?? "").toLowerCase();
    if (label === "lifestyle hero") return 4;
    if (label === "full shot") return 3;
    if (label.startsWith("lifestyle")) return 2;
    return 1;
  };
  const ranked = [...images]
    .map((img, i) => ({ img, i, s: score(img) }))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const hero = ranked[0]?.img ?? null;
  const supporting =
    ranked.find((r) => r.img !== hero && r.img.url !== hero?.url)?.img ?? null;
  return { hero, supporting };
}

function CinematicHero({
  hero,
  supporting,
  pending,
  status,
}: {
  hero: PreviewGeneratedImage | null;
  supporting: PreviewGeneratedImage | null;
  pending: boolean;
  status: PreviewPageData["status"];
}) {
  if (!hero) {
    if (status === "failed") return null;
    if (!pending) return null;
    return (
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden className="hidden h-px flex-1 bg-line-soft md:block" />
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3">
            After · Vesperdrop campaign
          </p>
          <span aria-hidden className="hidden h-px flex-1 bg-line-soft md:block" />
        </div>
        <div className="rounded-[24px] border border-line-soft bg-cream/40 px-6 py-12 text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
            Generating
          </p>
          <p className="mt-3 font-serif text-[16px] italic leading-[1.45] text-ink-3">
            Your campaign is being prepared — refresh in a moment.
          </p>
        </div>
      </div>
    );
  }

  if (!supporting) {
    return (
      <div className="md:max-w-none">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 -bottom-5 h-10 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(40,30,20,0.07)_0%,transparent_70%)] blur-2xl"
          />
          <HeroImage image={hero} priority size="primary" />
        </div>
        {hero.label ? (
          <p className="mt-3 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4 md:block">
            01 — {hero.label}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 -bottom-5 h-10 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(40,30,20,0.07)_0%,transparent_70%)] blur-2xl"
        />
        <div className="grid grid-cols-12 gap-3 md:gap-5">
          <div className="relative z-10 col-span-12 md:col-span-7">
            <HeroImage image={hero} priority size="primary" />
          </div>
          <div className="relative col-span-12 md:col-span-5 md:-ml-12 md:translate-y-10">
            <HeroImage
              image={supporting}
              priority={false}
              size="supporting"
              withEdge
            />
          </div>
        </div>
      </div>
      {hero.label ? (
        <p className="mt-3 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4 md:block">
          01 — {hero.label}
        </p>
      ) : null}
    </div>
  );
}

function HeroImage({
  image,
  priority,
  size,
  withEdge = false,
}: {
  image: PreviewGeneratedImage;
  priority: boolean;
  size: "primary" | "supporting";
  withEdge?: boolean;
}) {
  const aspect =
    image.aspect === "portrait"
      ? "aspect-[4/5]"
      : image.aspect === "landscape"
        ? "aspect-[7/5]"
        : size === "primary"
          ? "aspect-[4/5]"
          : "aspect-square";
  const radius = size === "primary" ? "rounded-[34px]" : "rounded-[28px]";
  const shadow =
    size === "primary"
      ? "shadow-[0_30px_70px_-30px_rgba(40,30,20,0.45)]"
      : "shadow-[0_18px_40px_-24px_rgba(40,30,20,0.3)]";
  const edge = withEdge ? "ring-1 ring-paper/80" : "";
  return (
    <figure className="relative motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.005] transition-transform duration-700 ease-out">
      <div
        className={`relative overflow-hidden ${radius} border border-[oklch(0.78_0.02_70)]/60 bg-cream ${shadow} ${edge}`}
      >
        <FaceSafeImage
          src={image.url}
          alt={image.label ?? "Generated image"}
          width={size === "primary" ? 1400 : 900}
          height={size === "primary" ? 1750 : 900}
          focalPoint={image.focalPoint ?? undefined}
          faceBox={image.faceBox ?? undefined}
          className={`${aspect} w-full object-cover`}
          priority={priority}
          unoptimized
        />
        {image.label ? (
          <span className="absolute left-4 top-4 rounded-full border border-line-soft bg-paper/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 shadow-[0_8px_20px_-12px_rgba(40,30,20,0.25)] backdrop-blur-[1px]">
            {image.label.toUpperCase()}
          </span>
        ) : null}
      </div>
    </figure>
  );
}

function HowWeGeneratedSection() {
  const steps = [
    {
      n: "01",
      title: "Your reference images",
      body: "Each uploaded image becomes its own product preview.",
    },
    {
      n: "02",
      title: "AI-powered generation",
      body: "Our AI creates premium, lifestyle images that look like a real photoshoot.",
    },
    {
      n: "03",
      title: "Ready-to-use assets",
      body: "You get high-converting images perfect for storefronts, marketplaces, and social campaigns.",
    },
  ];
  return (
    <section className="py-6 md:py-8">
      <div className="mb-4 md:mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
          Behind the scenes
        </p>
        <h2 className="mt-2 max-w-[24ch] font-serif text-[clamp(1.6rem,2.4vw,2.1rem)] leading-[1.08] tracking-[-0.018em] text-ink">
          How we generated these images.
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-3 sm:items-start sm:gap-x-2">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={`flex items-start gap-3 sm:flex-col sm:items-stretch ${i === 1 ? "md:translate-y-2" : i === 2 ? "md:translate-y-1" : ""}`}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
                {s.n}
              </p>
              {i < steps.length - 1 ? (
                <span aria-hidden className="hidden h-px flex-1 bg-line-soft sm:block" />
              ) : null}
            </div>
            <div>
              <p className="mt-2 font-serif text-[18px] leading-[1.15] tracking-[-0.012em] text-ink">
                {s.title}
              </p>
              <p className="mt-1.5 max-w-[28ch] text-[12.5px] leading-[1.5] text-ink-3">
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BenefitsRow() {
  return (
    <section className="py-4 md:py-6">
      <div className="grid grid-cols-1 gap-y-7 sm:grid-cols-2 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-line-soft/60">
        {[
          ["01", "Storefront ready", "Optimized for product pages, storefronts, and campaigns."],
          ["02", "Lifestyle focused", "Imagery that helps customers picture themselves using it."],
          ["03", "Higher conversions", "Editorial-grade visuals consistently outperform flat lays."],
          ["04", "Save time & money", "No photoshoot. No models. Minutes instead of days."],
        ].map(([num, title, body]) => (
          <div
            key={title}
            className="px-0 first:pl-0 md:px-8 md:first:pl-0"
          >
            <span aria-hidden className="block h-px w-8 bg-line-soft md:hidden" />
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4 md:mt-0">
              {num}
            </p>
            <p className="mt-2 font-serif text-[19px] leading-[1.12] tracking-[-0.012em] text-ink">
              {title}
            </p>
            <p className="mt-1.5 max-w-[22ch] text-[12.5px] leading-[1.5] text-ink-3">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AboutThisPreviewSection() {
  return (
    <section className="pb-14 md:pb-18">
      <div className="mx-auto max-w-[680px] text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
          About this preview
        </p>
        <p className="mt-4 text-[13.5px] leading-[1.6] text-ink-3">
          This page was created privately for you and is not listed publicly.
          Only people with this link can see it. Generated images are samples
          intended to demonstrate what Vesperdrop can produce for your store.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-soft bg-cream/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          <LockGlyph /> Unique unlisted link
        </span>
      </div>
    </section>
  );
}

function SectionDivider({ eyebrow }: { eyebrow?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 md:py-5">
      <span className="block h-px w-full max-w-[160px] bg-line-soft/70" />
      {eyebrow ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
          {eyebrow}
        </p>
      ) : null}
    </div>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
