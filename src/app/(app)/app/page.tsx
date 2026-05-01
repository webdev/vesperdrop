import Link from "next/link";
import { cookies } from "next/headers";
import type { Scene } from "@/lib/db/scenes";
import { sceneify } from "@/lib/sceneify/client";
import { RunForm } from "@/components/app/run-form";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ presets?: string; scenes?: string }>;
}) {
  const { presets: presetsParam, scenes: scenesParam } = await searchParams;
  const cookiePicks = (await cookies()).get("vd_picks")?.value;
  const initialSelected =
    (cookiePicks ?? presetsParam ?? scenesParam)
      ?.split(",")
      .filter(Boolean) ?? [];
  const presets = await sceneify().listPublicPresets();
  const filtered =
    initialSelected.length > 0
      ? presets.filter((p) => initialSelected.includes(p.slug))
      : presets;
  const scenes: Scene[] = filtered.map((p) => ({
    slug: p.slug,
    name: p.name,
    mood: p.mood,
    category: p.category,
    palette: p.palette,
    imageUrl: p.heroImageUrl,
  }));
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl">New batch</h1>
        <p className="text-zinc-500 mt-2">
          Upload product photos, pick styles, generate.
        </p>
      </header>
      <Link
        href="/app/discover"
        className="block bg-zinc-50 border border-zinc-200 rounded-lg px-5 py-4 hover:border-zinc-400 transition-colors group"
      >
        <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase mb-1">
          New · Style discovery
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg text-zinc-700">
            Not sure which scenes? Train your eye on a quick swipe deck.
          </p>
          <span className="font-mono text-xs tracking-[0.12em] text-orange-500 group-hover:translate-x-0.5 transition-transform shrink-0">
            Try Discover →
          </span>
        </div>
      </Link>
      <RunForm scenes={scenes} initialSceneIds={initialSelected} />
    </div>
  );
}
