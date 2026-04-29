export type ExtractedAttributes = {
  garment: string;
  color: string;
  material: string;
  cut?: string;
  pattern?: string;
  confidence: "high" | "medium" | "low";
};
