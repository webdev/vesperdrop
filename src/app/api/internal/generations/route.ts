import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = { presetSlug?: string };

export async function POST(req: Request) {
  if (process.env.E2E_SCENEIFY_MOCK !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const delayMsParam = Number(url.searchParams.get("delayMs"));
  const failParam = url.searchParams.get("fail") === "1";
  const delayMs = Number.isFinite(delayMsParam) && delayMsParam > 0 ? delayMsParam : 4000;

  const body = (await req.json().catch(() => ({}))) as Body;

  await new Promise((r) => setTimeout(r, delayMs));

  if (failParam) {
    return NextResponse.json({ error: "mock sceneify failure" }, { status: 502 });
  }

  return NextResponse.json({
    generationId: `mock-${Date.now()}`,
    outputUrl: "https://placehold.co/1024x1024/1b1915/f4f0e8.png?text=MOCK+GEN",
    model: "gpt-image-2",
    requestedModel: body.presetSlug ?? "unknown",
  });
}
