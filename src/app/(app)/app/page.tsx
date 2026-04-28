import Link from "next/link";
import { listScenes } from "@/lib/db/scenes";
import { RunForm } from "@/components/app/run-form";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ scenes?: string }>;
}) {
  const { scenes: scenesParam } = await searchParams;
  const initialSelected = scenesParam?.split(",").filter(Boolean) ?? [];
  const scenes = await listScenes();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-4xl">New batch</h1>
        <p className="text-[var(--color-ink-3)] mt-2">
          Upload product photos, pick styles, generate.
        </p>
      </header>
      <Link
        href="/app/discover"
        className="block bg-[var(--color-paper-2)] border border-[var(--color-line)] px-5 py-4 hover:border-[var(--color-ink-3)] transition-colors group"
      >
        <div className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-ink-3)] uppercase mb-1">
          New · Style discovery
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-serif text-lg italic font-light text-[var(--color-ink-2)]">
            Not sure which scenes? Train your eye on a quick swipe deck.
          </p>
          <span className="font-mono text-xs tracking-[0.12em] text-[var(--color-ember)] group-hover:translate-x-0.5 transition-transform shrink-0">
            Try Discover →
          </span>
        </div>
      </Link>
      <RunForm scenes={scenes} initialSceneIds={initialSelected} />
    </div>
  );
}
