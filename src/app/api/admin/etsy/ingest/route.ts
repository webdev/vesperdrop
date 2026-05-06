import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { readCandidatesMd } from "@/lib/etsy-outreach/source";
import { parseEtsyCandidatesMd } from "@/lib/etsy-outreach/parse-md";
import {
  upsertCandidatesFromParsed,
  deleteAllCandidates,
} from "@/lib/etsy-outreach/candidates";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const replaceAll = body?.replaceAll === true;

  const md = await readCandidatesMd();
  const { candidates, errors } = parseEtsyCandidatesMd(md);

  let deleted = 0;
  if (replaceAll) {
    deleted = await deleteAllCandidates();
  }
  const result = await upsertCandidatesFromParsed(candidates);

  return NextResponse.json({
    parsed: candidates.length,
    parseErrors: errors.length,
    upserted: result.inserted,
    deleted,
    replaceAll,
  });
}
