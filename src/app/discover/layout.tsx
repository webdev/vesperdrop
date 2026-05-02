import type { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Discover styles",
  description:
    "Swipe through scene presets and find the look that fits your product. Try Vesperdrop with one preset, free.",
  alternates: { canonical: "/discover" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteNav active="discover" />
      <Container as="main" width="app" className="flex-1 py-8">
        {children}
      </Container>
    </div>
  );
}
