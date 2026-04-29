import { SiteNav } from "@/components/marketing/site-nav";
import { Footer } from "@/components/marketing/footer";
import { StickyCta } from "@/components/marketing/sticky-cta";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/marketing/structured-data";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <SiteNav />
      <main>{children}</main>
      <StickyCta />
      <Footer />
    </>
  );
}
