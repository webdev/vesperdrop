import { SiteNav } from "@/components/marketing/site-nav";
import { Footer } from "@/components/marketing/footer";
import { StickyCta } from "@/components/marketing/sticky-cta";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <StickyCta />
      <Footer />
    </>
  );
}
