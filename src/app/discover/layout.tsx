import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app/app-nav";
import { Container } from "@/components/ui/container";
import { firstNameFrom } from "@/lib/user-display";
import { getCreditsBalance } from "@/lib/db/credits";

export const metadata: Metadata = {
  title: "Discover styles",
  description:
    "Swipe through scene presets and find the look that fits your product. Try Vesperdrop with one preset, free.",
  alternates: { canonical: "/discover" },
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const credits = user ? await getCreditsBalance(user.id) : null;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <AppNav
        firstName={user ? firstNameFrom(user) : null}
        email={user?.email ?? ""}
        credits={credits}
        active="discover"
      />
      <Container as="main" width="app" className="flex-1 py-10 md:py-14">
        {children}
      </Container>
    </div>
  );
}
