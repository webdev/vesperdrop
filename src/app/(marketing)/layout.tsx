import { SiteNav } from "@/components/marketing/site-nav";
import { Footer } from "@/components/marketing/footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
