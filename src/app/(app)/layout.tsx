import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Nav } from "@/components/nav";
import { IdentifyUser } from "@/components/identify-user";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: string | undefined;
  if (user) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    plan = (profile?.plan as string | undefined) ?? "free";
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {user ? (
        <IdentifyUser id={user.id} email={user.email ?? ""} plan={plan} />
      ) : null}
      <Nav />
      <Container as="main" width="app" className="flex-1 py-10 md:py-14">
        {children}
      </Container>
    </div>
  );
}
