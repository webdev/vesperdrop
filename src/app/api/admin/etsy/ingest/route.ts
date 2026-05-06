import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { readCandidatesMd } from "@/lib/etsy-outreach/source";
import { parseEtsyCandidatesMd } from "@/lib/etsy-outreach/parse-md";
import { upsertCandidatesFromParsed } from "@/lib/etsy-outreach/candidates";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const md = await readCandidatesMd();
  const { candidates, errors } = parseEtsyCandidatesMd(md);
  const result = await upsertCandidatesFromParsed(candidates);

  return NextResponse.json({
    parsed: candidates.length,
    parseErrors: errors.length,
    upserted: result.inserted,
  });
}
