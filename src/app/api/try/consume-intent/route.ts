import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { tryIntents } from "@/lib/db/schema";

// Look up the latest unconsumed try-intent for the currently-authenticated
// user (matched on email — we don't link by user_id at save-intent time
// because signUp's session is null pre-confirmation). On hit, mark the row
// consumed and return its payload so try-flow can hydrate the upload +
// scenes after the user lands back authed via the email confirmation link.
//
// Authed-only: only the user themselves should be able to consume their
// pending intent.

export const runtime = "nodejs";

export async function POST(req: Request) {
  // POST not GET so the response is never cached and so a stray browser
  // pre-fetch can't accidentally consume + clear the intent.
  void req;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = user.email.toLowerCase();

  const rows = await db
    .select()
    .from(tryIntents)
    .where(and(eq(tryIntents.email, email), isNull(tryIntents.consumedAt)))
    .orderBy(desc(tryIntents.createdAt))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ intent: null });
  }

  const row = rows[0];

  // Mark consumed so a second render or a cross-tab race can't replay the
  // same hydration and overwrite an in-progress batch.
  await db
    .update(tryIntents)
    .set({ consumedAt: new Date() })
    .where(eq(tryIntents.id, row.id));

  return NextResponse.json({
    intent: {
      sourceUrl: row.sourceUrl,
      photoName: row.sourceName,
      photoMimeType: row.sourceMimeType,
      pickedScenes: row.pickedScenes,
    },
  });
}
