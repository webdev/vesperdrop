import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Container } from "@/components/ui/container";

const DISCOVER_TITLE = "Discover lifestyle photography styles";
const DISCOVER_DESCRIPTION =
  "Swipe through scene presets — beach, kitchen, studio, golden hour — and find the look that fits your product. Try Vesperdrop with one preset, free.";

export const metadata: Metadata = {
  title: DISCOVER_TITLE,
  description: DISCOVER_DESCRIPTION,
  alternates: { canonical: "/discover" },
  openGraph: {
    title: DISCOVER_TITLE,
    description: DISCOVER_DESCRIPTION,
    url: "/discover",
    type: "website",
  },
  twitter: {
    title: DISCOVER_TITLE,
    description: DISCOVER_DESCRIPTION,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Nav />
      <Container as="main" width="app" className="flex-1 py-8">
        {children}
      </Container>
    </div>
  );
}
