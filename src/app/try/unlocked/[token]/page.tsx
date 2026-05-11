import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "./download-button";
import { stripe } from "@/lib/stripe/server";
import {
  getUnlockBatchByToken,
  markBatchPaid,
} from "@/lib/db/unlock-batches";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Your unlocked photos · Vesperdrop",
  robots: { index: false, follow: false },
};

export default async function UnlockedPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id } = await searchParams;
  const batch = await getUnlockBatchByToken(token);
  if (!batch) return notFound();

  let isPaid = batch.status === "paid";

  // Stripe sometimes redirects the user before checkout.session.completed
  // lands on our webhook. Verify the session synchronously as a fallback so
  // we don't show a "still processing" wall to a paid customer.
  if (!isPaid && session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (
        session.payment_status === "paid" &&
        session.metadata?.unlock_batch_token === token
      ) {
        isPaid = true;
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        await markBatchPaid({
          token,
          paymentIntent,
          customerEmail:
            session.customer_details?.email ?? session.customer_email ?? null,
        });
      }
    } catch (err) {
      console.error("[try/unlocked] stripe verify failed", err);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-line-soft py-4">
        <Container width="marketing" className="flex items-center justify-between">
          <Link href="/" className="font-serif text-[20px] tracking-tight">
            Vesperdrop
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
            {isPaid ? "Unlocked" : "Pending"}
          </span>
        </Container>
      </header>

      <main className="flex-1">
        <Container width="marketing" className="py-10 md:py-14">
          <div className="mb-8 md:mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              {isPaid ? "Your photos · HD ready" : "Your photos"}
            </p>
            <h1 className="mt-2 max-w-[20ch] font-serif text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] tracking-[-0.025em] text-ink">
              {isPaid
                ? "Download your HD photos."
                : "Almost there — payment is finalizing."}
            </h1>
            {!isPaid ? (
              <p className="mt-4 max-w-[52ch] text-[14.5px] leading-[1.55] text-ink-3">
                Payment is still processing. Refresh this page in a moment, or
                re-open checkout if it didn&apos;t go through.
              </p>
            ) : null}
          </div>

          {!isPaid ? (
            <div className="mb-10 flex flex-wrap items-center gap-3">
              <Button render={<a href={`/api/stripe/unlock-checkout?batchToken=${token}`} />}>
                Re-open checkout
              </Button>
              <Button variant="outline" render={<a href={`/try/unlocked/${token}`} />}>
                Refresh
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-12">
            {batch.generations.map((g, i) => {
              const showRaw = isPaid && g.rawUrl;
              const src = showRaw ? g.rawUrl! : g.outputUrl;
              const colSpan = i === 0 ? "md:col-span-7" : "md:col-span-5";
              return (
                <figure
                  key={`${g.sceneSlug}-${i}`}
                  className={`relative ${colSpan}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                      {String(i + 1).padStart(2, "0")} — {g.sceneName}
                    </p>
                    {g.isFreePreview ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">
                        Free preview
                      </span>
                    ) : !isPaid ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-terracotta">
                        Locked
                      </span>
                    ) : null}
                  </div>
                  <div className="relative overflow-hidden rounded-[28px] border border-line-soft bg-cream shadow-[0_24px_60px_-30px_rgba(40,30,20,0.4)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={g.sceneName}
                      className="block w-full object-cover"
                    />
                  </div>
                  {isPaid && g.rawUrl ? (
                    <div className="mt-4">
                      <DownloadButton
                        url={g.rawUrl}
                        filename={`vesperdrop-${g.sceneSlug}.png`}
                      />
                    </div>
                  ) : null}
                </figure>
              );
            })}
          </div>

          {isPaid ? (
            <div className="mt-14 flex flex-col items-center gap-3 text-center">
              <span className="block h-px w-full max-w-[120px] bg-line-soft" />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                Save this link
              </p>
              <p className="max-w-[44ch] font-serif text-[14px] italic leading-[1.55] text-ink-3">
                Bookmark this page to download again later. Files are kept for 7
                days.
              </p>
            </div>
          ) : null}
        </Container>
      </main>
    </div>
  );
}
