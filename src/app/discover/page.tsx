import { sceneify } from "@/lib/sceneify/client";
import { DiscoverItemListJsonLd } from "@/components/marketing/structured-data";
import { SwipeDeck } from "./swipe-deck";

export const dynamic = "force-dynamic";

export default async function Page() {
  const presets = await sceneify().listPublicPresets();
  return (
    <>
      <DiscoverItemListJsonLd
        items={presets.map((p) => ({
          name: p.name,
          description: p.description ?? undefined,
          imageUrl: p.heroImageUrl ?? undefined,
          slug: p.slug,
        }))}
      />
      <SwipeDeck presets={presets} />
    </>
  );
}
