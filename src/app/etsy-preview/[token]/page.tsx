import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";
import { recordEvent } from "@/lib/etsy-outreach/events";
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

const VIEW_COOKIE_PREFIX = "vd_etsy_view_";

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

  const cookieStore = await cookies();
  const cookieName = `${VIEW_COOKIE_PREFIX}${page.id.slice(0, 8)}`;
  const alreadySeen = cookieStore.get(cookieName)?.value === "1";
  const hdrs = await headers();
  if (!alreadySeen) {
    await recordEvent({
      pageId: page.id,
      kind: "view",
      userAgent: hdrs.get("user-agent"),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip"),
    });
    cookieStore.set(cookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
  }

  cookieStore.set(
    "vd_etsy_ref",
    JSON.stringify({ token, candidate_id: page.candidateId }),
    { httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" },
  );

  const snap = page.listingSnapshot;
  const greeting = snap.shopName
    ? `Hi ${snap.shopName}, this is what`
    : "Hi there, this is what";
  const generated = [page.heroUrl, page.lifestyleUrl, page.detailUrl].filter(
    (u): u is string => Boolean(u),
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-line-soft py-5">
        <Container width="marketing" className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[20px] tracking-tight">
            Vesperdrop
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            Private preview
          </span>
        </Container>
      </header>

      <main className="flex-1 py-14 md:py-20">
        <Container width="marketing" className="flex flex-col gap-16">
          <PreviewViewTracker
            token={token}
            candidateId={page.candidateId}
            sellerName={snap.shopName}
            listingUrl={snap.listingUrl}
          />

          <section className="max-w-[58ch]">
            <h1 className="font-serif text-[clamp(2.4rem,4vw,3.6rem)] leading-[1.05] tracking-[-0.02em]">
              {greeting}{" "}
              <span className="text-terracotta">your product</span> could look
              like on Shopify.
            </h1>
            <p className="mt-5 text-[15px] text-ink-3">
              We created these examples from your Etsy listing to help you
              visualize the possibilities.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr] md:items-start">
            <div className="rounded-2xl border border-line-soft bg-surface p-4">
              {snap.imageUrl ? (
                <Image
                  src={snap.imageUrl}
                  alt={snap.title}
                  width={260}
                  height={325}
                  className="w-full rounded-lg object-cover"
                  unoptimized
                />
              ) : page.sourceBlobUrl ? (
                <Image
                  src={page.sourceBlobUrl}
                  alt={snap.title}
                  width={260}
                  height={325}
                  className="w-full rounded-lg object-cover"
                  unoptimized
                />
              ) : null}
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                Etsy listing
              </p>
              <p className="mt-2 line-clamp-2 text-[13px] text-ink">
                {snap.title}
              </p>
              {(snap.shopName || snap.category) ? (
                // shopUrl is not stored in listing_snapshot (denormalized at creation time);
                // link to shop is not possible without a schema change + backfill.
                <p className="mt-1 text-[12px] text-ink-3">
                  {snap.shopName ?? ""}
                  {snap.shopName && snap.category ? " · " : ""}
                  {snap.category ?? ""}
                </p>
              ) : null}
              <Link
                href={snap.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[12px] text-ink-3 underline-offset-4 hover:underline"
              >
                View original ↗
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {generated.map((url, i) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-2xl border border-line-soft bg-surface"
                >
                  <Image
                    src={url}
                    alt={`Generated example ${i + 1}`}
                    width={400}
                    height={500}
                    className="aspect-[4/5] w-full object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              ["Shopify ready", "Sized and styled for product pages."],
              ["Lifestyle focused", "Context that helps customers picture themselves wearing it."],
              ["Higher conversions", "Editorial-grade imagery converts better than flat lays."],
              ["Save time & money", "No photoshoot. Minutes instead of days."],
            ].map(([title, body]) => (
              <div key={title}>
                <p className="font-serif text-[16px] text-ink">{title}</p>
                <p className="mt-1 text-[12px] text-ink-3">{body}</p>
              </div>
            ))}
          </section>

          <PreviewCta
            token={token}
            candidateId={page.candidateId}
            sellerName={snap.shopName}
            listingUrl={snap.listingUrl}
          />

          <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">
            This is a private preview made just for you by Vesperdrop.
          </p>
        </Container>
      </main>
    </div>
  );
}
