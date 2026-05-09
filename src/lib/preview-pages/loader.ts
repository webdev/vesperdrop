import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { FocalPoint, FaceBox } from "@/lib/ai/sceneify";
import {
  IG_SLOT_ASPECT,
  IG_SLOT_LABEL,
  type IgSlotType,
} from "@/lib/ig-previews/slot-types";

export type PreviewSourceType = "ig_leadgen" | "etsy_preview";

export type PreviewGeneratedImage = {
  url: string;
  sourceIndex: number;
  label?: string;
  presetSlug?: string;
  focalPoint?: FocalPoint | null;
  faceBox?: FaceBox | null;
  aspect?: "square" | "portrait" | "landscape";
};

export type PreviewOriginalImage = { url: string; alt?: string };

export type PreviewPageData = {
  id: string;
  token: string;
  sourceType: PreviewSourceType;
  status: "pending" | "queued" | "generating" | "partial" | "completed" | "failed";
  title: string | null;
  sellerName: string | null;
  productTitle: string | null;
  listingUrl: string | null;
  originalImages: PreviewOriginalImage[];
  generatedImages: PreviewGeneratedImage[];
  createdAt: Date;
};

const EDITORIAL_LABELS = ["Lifestyle hero", "Full shot", "Texture detail"] as const;

export async function getPreviewPageByToken(
  token: string,
): Promise<PreviewPageData | null> {
  const etsy = await db
    .select()
    .from(schema.etsyPreviewPages)
    .where(eq(schema.etsyPreviewPages.token, token))
    .limit(1);
  if (etsy[0]) return mapEtsy(etsy[0]);

  const ig = await db
    .select()
    .from(schema.igPreviews)
    .where(eq(schema.igPreviews.slug, token))
    .limit(1);
  if (ig[0]) return mapIg(ig[0]);

  return null;
}

function mapEtsy(
  row: typeof schema.etsyPreviewPages.$inferSelect,
): PreviewPageData {
  const snap = row.listingSnapshot;
  const generated: PreviewGeneratedImage[] = [];
  if (row.lifestyleUrl) {
    generated.push({
      url: row.lifestyleUrl,
      sourceIndex: 0,
      label: "Lifestyle hero",
      focalPoint: row.lifestyleFocalPoint,
      faceBox: row.lifestyleFaceBox,
      aspect: "portrait",
    });
  }
  if (row.heroUrl) {
    generated.push({
      url: row.heroUrl,
      sourceIndex: 0,
      label: "Full shot",
      focalPoint: row.heroFocalPoint,
      faceBox: row.heroFaceBox,
      aspect: "square",
    });
  }
  if (row.detailUrl) {
    generated.push({
      url: row.detailUrl,
      sourceIndex: 0,
      label: "Texture detail",
      focalPoint: row.detailFocalPoint,
      faceBox: row.detailFaceBox,
      aspect: "landscape",
    });
  }
  const originalUrl = snap.imageUrl ?? row.sourceBlobUrl ?? null;
  return {
    id: row.id,
    token: row.token,
    sourceType: "etsy_preview",
    status: row.status,
    title: snap.title,
    sellerName: snap.shopName,
    productTitle: snap.title,
    listingUrl: snap.listingUrl,
    originalImages: originalUrl ? [{ url: originalUrl, alt: snap.title }] : [],
    generatedImages: generated,
    createdAt: row.createdAt,
  };
}

function mapIg(row: typeof schema.igPreviews.$inferSelect): PreviewPageData {
  const aspectCycle: Array<"portrait" | "square" | "landscape"> = [
    "portrait",
    "square",
    "landscape",
  ];
  const generated: PreviewGeneratedImage[] = row.outputs
    .filter((o) => typeof o?.url === "string" && o.url.length > 0)
    .map((o, i) => {
      const slot = o.slotType as IgSlotType | undefined;
      const label = slot
        ? IG_SLOT_LABEL[slot]
        : EDITORIAL_LABELS[i % EDITORIAL_LABELS.length];
      const aspect = slot
        ? IG_SLOT_ASPECT[slot]
        : aspectCycle[i % aspectCycle.length];
      return {
        url: o.url,
        sourceIndex: o.sourceIndex,
        label,
        presetSlug: o.presetSlug,
        focalPoint: o.focalPoint ?? null,
        faceBox: o.faceBox ?? null,
        aspect,
      };
    });
  const originalImages: PreviewOriginalImage[] = row.sourceImages.map((s) => ({
    url: s.url,
    alt: s.name,
  }));
  return {
    id: row.id,
    token: row.slug,
    sourceType: "ig_leadgen",
    status: row.status,
    title: row.title,
    sellerName: null,
    productTitle: row.title,
    listingUrl: null,
    originalImages,
    generatedImages: generated,
    createdAt: row.createdAt,
  };
}
