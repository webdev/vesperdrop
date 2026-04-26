import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app/app-nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <>
      <AppNav email={user?.email ?? ""} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
