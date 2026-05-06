import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Container } from "@/components/ui/container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminSidebar } from "./admin/etsy-candidates/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    notFound(); // 404 — never reveal that the route exists
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Nav width="app" />
      <main className="flex-1 py-8 md:py-10">
        <Container width="app">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
            <AdminSidebar />
            <div className="min-w-0">{children}</div>
          </div>
        </Container>
      </main>
    </div>
  );
}
