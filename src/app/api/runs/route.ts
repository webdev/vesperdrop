import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { start } from "workflow/api";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createRun } from "@/lib/db/runs";
import { insertPendingGenerations } from "@/lib/db/generations";
import { tryTakeToken } from "@/lib/db/rate-limit";
import { tryDeductCredits } from "@/lib/db/credits";
import { processRun } from "@/lib/workflows/process-run";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allowed = await tryTakeToken(
    user.id,
    "runs",
    env.RUNS_PER_MINUTE_PER_USER,
    env.RUNS_PER_MINUTE_PER_USER,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 },
    );
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const presetIds = form.getAll("presetIds").map(String);

  const parsed = z.object({
    presetIds: z.array(z.string().min(1)).min(1).max(20),
    files: z.array(z.any()).min(1).max(20),
  }).safeParse({ presetIds, files });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const total = files.length * presetIds.length;
  if (total > env.MAX_RUN_IMAGES) {
    return NextResponse.json(
      { error: `Run exceeds ${env.MAX_RUN_IMAGES} images.` },
      { status: 400 },
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, credits_balance")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const isFreePlan = plan === "free";

  // Free plan with 0 credits can't generate (except they get 1 free credit on signup)
  if (isFreePlan) {
    const creditsAvailable = profile?.credits_balance ?? 0;
    if (creditsAvailable < total) {
      return NextResponse.json(
        { error: "Insufficient credits. Upgrade to Pro or purchase credit packs." },
        { status: 402 },
      );
    }
  }

  // Deduct credits (only for free plan; paid plans are unlimited by credits)
  if (isFreePlan) {
    const ok = await tryDeductCredits(user.id, total);
    if (!ok) {
      return NextResponse.json(
        { error: "Insufficient credits. Upgrade to Pro or purchase credit packs." },
        { status: 402 },
      );
    }
  }

  const origin = new URL(req.url).origin;
  const sourceUploads = await Promise.all(
    files.map(async (file, i) => {
      const placeholderKey = `pending-${user.id}-${Date.now()}-${i}`;
      let blobUrl: string;
      if (env.BLOB_READ_WRITE_TOKEN) {
        const result = await put(`runs/${placeholderKey}`, file, { access: "public" });
        blobUrl = result.url;
      } else {
        const dir = path.join(process.cwd(), "public", "uploads");
        await mkdir(dir, { recursive: true });
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const filename = `${placeholderKey}-${safeName}`;
        await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
        blobUrl = `${origin}/uploads/${filename}`;
      }
      return { blobUrl, filename: file.name, mimeType: file.type, placeholderKey };
    }),
  );

  const { id: runId } = await createRun({
    userId: user.id,
    sourceCount: files.length,
    presetCount: presetIds.length,
  });

  const rows: Array<{ runId: string; userId: string; sceneifySourceId: string; presetId: string }> = [];
  for (const upload of sourceUploads) {
    for (const presetId of presetIds) {
      rows.push({ runId, userId: user.id, sceneifySourceId: upload.placeholderKey, presetId });
    }
  }
  await insertPendingGenerations(rows);

  const run = await start(processRun, [runId, user.id, sourceUploads, origin]);

  return NextResponse.json({ runId, workflowRunId: run.runId });
}
