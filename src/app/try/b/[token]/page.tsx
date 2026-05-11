import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Container } from "@/components/ui/container";
import { stripe } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachBatchToUser,
  getUnlockBatchByToken,
  markBatchPaid,
} from "@/lib/db/unlock-batches";
import { BatchView } from "./batch-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Your studio · Vesperdrop",
  description: "Your generated studio set on Vesperdrop.",
  robots: { index: false, follow: false },
};

// /try/b/[token] is the canonical home for a generated batch — the
// URL Try Flow flips to via history.replaceState the moment
// /api/try/finalize-batch resolves. The page adapts to every state:
//
//   missing token           → 404
//   pending + unclaimed     → editorial reveal + Claim CTA
//   pending + claimed       → editorial reveal + Complete-the-set upsell
//   paid                    → editorial reveal, all tiles unlocked,
//                             Download HD pills on each tile
//
// Stripe Checkout's success_url comes back here with ?session_id=...;
// we verify the session synchronously as a fallback so the user
// isn't blocked by webhook delivery latency.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id } = await searchParams;

  const batch = await getUnlockBatchByToken(token);
  if (!batch) notFound();

  let isPaid = batch.status === "paid";

  // Stripe sometimes redirects the user before the webhook lands on
  // our `checkout.session.completed` handler. Verify the session
  // synchronously so the post-payment view renders immediately
  // instead of looking like the unpaid state.
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
      console.error("[try/b] stripe verify failed", err);
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auto-claim path: an authed visitor finding a batch with no owner
  // becomes the owner. The 32-char hex token is unguessable so this
  // can't cross-pollinate — whoever has the URL is treated as the
  // legitimate visitor. Covers the case where the user signed in via
  // a magic link (still present in Supabase's default email template)
  // instead of entering the inline OTP — they'd otherwise return to
  // /try/b/<token> with batch.userId=null and see the claim form even
  // though they're already logged in.
  if (user && !batch.userId) {
    await attachBatchToUser(token, user.id);
    batch.userId = user.id;
  }
  const initialClaimed =
    batch.userId !== null && batch.userId === (user?.id ?? null);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Nav width="app" />
      <Container as="main" width="app" className="flex-1 py-10 md:py-16">
        <BatchView
          token={token}
          generations={batch.generations}
          initialClaimed={initialClaimed}
          initialPaid={isPaid}
        />
      </Container>
    </div>
  );
}
