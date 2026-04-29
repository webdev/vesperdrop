import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MOCK_PRESETS = [
  {
    slug: "linen-chair",
    name: "Linen Chair",
    description: "calm, midcentury interior",
    mood: "calm",
    category: "INTERIOR",
    palette: ["#d8c9b8", "#735e4b"],
    displayOrder: 1,
    heroImageUrl: "/filmstrip/interior/01.jpg",
  },
  {
    slug: "kitchen-counter",
    name: "Kitchen Counter",
    description: "warm morning light",
    mood: "warm",
    category: "INTERIOR",
    palette: ["#e6d2b3", "#a78b6e"],
    displayOrder: 2,
    heroImageUrl: "/filmstrip/interior/02.jpg",
  },
  {
    slug: "city-sidewalk",
    name: "City Sidewalk",
    description: "muted urban afternoon",
    mood: "urban",
    category: "STREET",
    palette: ["#4a4a52", "#9a9aa8"],
    displayOrder: 3,
    heroImageUrl: "/filmstrip/street/01.jpg",
  },
  {
    slug: "studio-paper",
    name: "Studio Paper",
    description: "soft seamless backdrop",
    mood: "clean",
    category: "STUDIO",
    palette: ["#f4f0e8", "#bfb59c"],
    displayOrder: 4,
    heroImageUrl: "/filmstrip/studio/01.jpg",
  },
  {
    slug: "garden-path",
    name: "Garden Path",
    description: "verdant exterior",
    mood: "fresh",
    category: "EXTERIOR",
    palette: ["#7a8a66", "#c8cfb1"],
    displayOrder: 5,
    heroImageUrl: "/filmstrip/exterior/01.jpg",
  },
];

export async function GET() {
  if (process.env.E2E_SCENEIFY_MOCK !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ presets: MOCK_PRESETS });
}
