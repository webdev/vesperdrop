import type { Metadata } from "next";
import { TryFlow } from "./try-flow";

export const metadata: Metadata = {
  title: "Try Darkroom — develop a sample batch",
  description:
    "Drop a product photo, pick a style, and watch Darkroom develop a 6-image lifestyle batch — no account, no card.",
};

export default function Page() {
  return <TryFlow />;
}
