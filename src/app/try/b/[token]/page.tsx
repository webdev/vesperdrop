import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { Container } from "@/components/ui/container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnlockBatchByToken } from "@/lib/db/unlock-batches";
import { BatchView } from "./batch-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Your studio · Vesperdrop",
  description: "Your generated studio set on Vesperdrop.",
  robots: { index: false, follow: false },
};

// /try/b/[token] is the persistent deep link for a generated batch.
// The URL is the canonical home for the batch — try-flow.tsx flips
// the browser URL here as soon as /api/try/finalize-batch resolves,
// so refresh/back/bookmark all keep the user on the same studio.
//
// State routing:
//   missing token       → 404
//   paid                → /try/unlocked/[token] (post-pay view exists)
//   pending (any state) → renders the editorial reveal + claim/upsell
//                         rail; OTP claim attaches the batch to the
//                         signed-in user.
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const batch = await getUnlockBatchByToken(token);
  if (!batch) notFound();
  if (batch.status === "paid") {
    redirect(`/try/unlocked/${token}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        />
      </Container>
    </div>
  );
}
