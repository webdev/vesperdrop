export function pickRandomPresets(slugs: string[], count: number): string[] {
  if (slugs.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(slugs[Math.floor(Math.random() * slugs.length)]);
  }
  return out;
}

export function planGeneration(sourceCount: number): {
  perImage: number;
  totalCount: number;
  description: string;
} {
  if (sourceCount <= 2) {
    return {
      perImage: 0,
      totalCount: 3,
      description: "3 random presets",
    };
  }
  return {
    perImage: 2,
    totalCount: sourceCount * 2,
    description: "2 per image",
  };
}
