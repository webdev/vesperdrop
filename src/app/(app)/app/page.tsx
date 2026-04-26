import { sceneify } from "@/lib/sceneify/client";
import { RunForm } from "@/components/app/run-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const presets = await sceneify().listPresets();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-4xl">New batch</h1>
        <p className="text-[var(--color-ink-3)] mt-2">
          Upload product photos, pick presets, generate.
        </p>
      </header>
      <RunForm presets={presets} />
    </div>
  );
}
