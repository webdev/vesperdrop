import type { Metadata } from "next";
import { listScenes } from "@/lib/db/scenes";
import { TryFlow } from "./try-flow";

export const metadata: Metadata = {
  title: "Try Darkroom — develop a sample batch",
  description:
    "Drop a product photo, pick a style, and watch Darkroom develop a 6-image lifestyle batch — no account, no card.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const scenes = await listScenes();
  return <TryFlow scenes={scenes} />;
}
