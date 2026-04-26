import { sceneify } from "@/lib/sceneify/client";
import { SwipeDeck } from "./swipe-deck";

export const dynamic = "force-dynamic";

export default async function Page() {
  const presets = await sceneify().listPresets();
  return <SwipeDeck presets={presets} />;
}
