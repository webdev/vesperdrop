import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { parseEtsyCandidatesMd } from "@/lib/etsy-outreach/parse-md";
import {
  upsertCandidatesFromParsed,
  deleteAllCandidates,
} from "@/lib/etsy-outreach/candidates";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const replaceAll = form.get("replaceAll") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size > 5_000_000) {
    return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 413 });
  }

  const text = await file.text();
  const { candidates, errors } = parseEtsyCandidatesMd(text);

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
