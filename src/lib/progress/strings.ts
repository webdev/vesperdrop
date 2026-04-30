import type { ExtractedAttributes } from "@/lib/ai/extract-attributes";

export type PhaseId = "reading" | "choosing" | "composing" | "matching" | "finishing";

export type PhaseLine = { template: string; personal: boolean };

export type Phase = {
  id: PhaseId;
  weight: number;
  lines: PhaseLine[];
};

export type PresetMeta = {
  slug: string;
  name: string;
  mood: string;
  palette: string[];
  category: string;
};

export const PHASES: Phase[] = [
  {
    id: "reading",
    weight: 0.10,
    lines: [
      { template: "Reading your {color} {garment}…", personal: true },
      { template: "Studying the {material} grain…", personal: true },
      { template: "Looking at your photo…", personal: false },
      { template: "Mapping shape and texture…", personal: false },
    ],
  },
  {
    id: "choosing",
    weight: 0.15,
    lines: [
      { template: "Pulling references for the {presetName} set…", personal: false },
      { template: "Sorting through {mood} shots that match…", personal: false },
      { template: "Picking 5 references that fit your {garment}…", personal: true },
      { template: "Choosing the right {mood} reference frames…", personal: false },
    ],
  },
  {
    id: "composing",
    weight: 0.45,
    lines: [
      { template: "Placing the {garment} into the scene…", personal: true },
      { template: "Building light to match {palette[0]}…", personal: false },
      { template: "Composing in {presetName}…", personal: false },
      { template: "Setting up the angle and framing…", personal: false },
      { template: "Working {color} into the scene's palette…", personal: true },
      { template: "Layering shadows and highlights…", personal: false },
    ],
  },
  {
    id: "matching",
    weight: 0.20,
    lines: [
      { template: "Color-matching against {palette[0]} and {palette[1]}…", personal: false },
      { template: "Tuning shadow to read true…", personal: false },
      { template: "Pulling the {color} closer to reference…", personal: true },
      { template: "Aligning tones to the {mood} mood…", personal: false },
    ],
  },
  {
    id: "finishing",
    weight: 0.10,
    lines: [
      { template: "Final pass…", personal: false },
      { template: "Print-ready clean-up…", personal: false },
      { template: "Sharpening and exporting…", personal: false },
    ],
  },
];

export function phaseAtElapsed(elapsedMs: number, totalEstMs: number): PhaseId {
  let cumulative = 0;
  for (const phase of PHASES) {
    cumulative += phase.weight * totalEstMs;
    if (elapsedMs < cumulative) return phase.id;
  }
  return PHASES[PHASES.length - 1].id;
}

export function pickLine(
  phaseId: PhaseId,
  attributes: ExtractedAttributes | null,
  preset: PresetMeta,
  history: string[],
): string {
  const phase = PHASES.find((p) => p.id === phaseId);
  if (!phase) return "";

  const eligible = attributes
    ? phase.lines
    : phase.lines.filter((l) => !l.personal || canFillPersonal(l.template, attributes));

  const recent = new Set(history.slice(-1));
  const interpolated = eligible
    .map((l) => interpolate(l.template, attributes, preset))
    .filter((s) => !recent.has(s));

  const pool = interpolated.length > 0 ? interpolated : eligible.map((l) => interpolate(l.template, attributes, preset));
  return pool[Math.floor(Math.random() * pool.length)];
}

function canFillPersonal(template: string, attrs: ExtractedAttributes | null): boolean {
  if (!attrs) return false;
  const tokens = template.match(/\{(\w+)\}/g) ?? [];
  return tokens.every((t) => {
    const key = t.slice(1, -1);
    return key in attrs && (attrs as Record<string, unknown>)[key];
  });
}

function interpolate(template: string, attrs: ExtractedAttributes | null, preset: PresetMeta): string {
  const slots: Record<string, string | undefined> = {
    garment: attrs?.garment,
    color: attrs?.color,
    material: attrs?.material,
    cut: attrs?.cut,
    pattern: attrs?.pattern,
    mood: preset.mood,
    presetName: preset.name,
    "palette[0]": preset.palette[0],
    "palette[1]": preset.palette[1],
    "palette[2]": preset.palette[2],
  };
  return template
    .replace(/\{([^}]+)\}/g, (_, key) => slots[key] ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.…,;:])/g, "$1")
    .replace(/^\s*your\s+(?=…|$)/i, "")
    .trim();
}
