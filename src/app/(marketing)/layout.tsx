import { SiteNav } from "@/components/marketing/site-nav";
import { Footer } from "@/components/marketing/footer";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/marketing/structured-data";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <SiteNav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
