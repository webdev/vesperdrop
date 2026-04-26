import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRunForUser } from "@/lib/db/runs";
import { listGenerationsForRun } from "@/lib/db/generations";
import { RunGrid } from "./run-grid";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/app/runs/${id}`);
  let run;
  try {
    run = await getRunForUser(id, user.id);
  } catch {
    notFound();
  }
  const initial = await listGenerationsForRun(id, user.id);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Run</h1>
        <p className="text-sm text-[var(--color-ink-3)]">{run.total_images} images</p>
      </header>
      <RunGrid runId={id} initial={initial} />
    </div>
  );
}
