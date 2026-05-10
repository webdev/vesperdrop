import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachBatchToUser,
  getUnlockBatchByToken,
} from "@/lib/db/unlock-batches";

export const runtime = "nodejs";

// Called by the /try inline OTP flow once verifyOtp resolves. The
// frontend holds the batch token from /api/try/finalize-batch; this
// route binds that anonymous batch to the now-authenticated user so
// the post-payment unlock page (and the user's library) can find it.
//
// Idempotent: if the batch is already attached to this user, returns
// ok:true. If it's attached to a different user (race / abuse),
// returns 409. If the token doesn't exist, returns 404.
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = z.object({ token: z.string().min(8).max(128) }).safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const batch = await getUnlockBatchByToken(parsed.data.token);
  if (!batch) {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }

  if (batch.userId === user.id) {
    return NextResponse.json({ ok: true, alreadyAttached: true });
  }

  if (batch.userId && batch.userId !== user.id) {
    return NextResponse.json(
      { error: "batch belongs to another account" },
      { status: 409 },
    );
  }

  const attached = await attachBatchToUser(parsed.data.token, user.id);
  if (!attached) {
    // Lost a race — re-read to figure out what happened.
    const refreshed = await getUnlockBatchByToken(parsed.data.token);
    if (refreshed?.userId === user.id) {
      return NextResponse.json({ ok: true, alreadyAttached: true });
    }
    return NextResponse.json(
      { error: "batch could not be attached" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
