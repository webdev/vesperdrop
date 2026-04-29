const KEYS = ["exterior", "interior", "street", "studio", "default"] as const;
type FilmstripCategory = (typeof KEYS)[number];

const FILMSTRIP_BY_CATEGORY: Record<FilmstripCategory, string[]> = Object.fromEntries(
  KEYS.map((k) => [
    k,
    [1, 2, 3, 4, 5].map((i) => `/filmstrip/${k}/${String(i).padStart(2, "0")}.jpg`),
  ]),
) as Record<FilmstripCategory, string[]>;

export function filmstripFor(category: string | null | undefined): string[] {
  if (!category) return FILMSTRIP_BY_CATEGORY.default;
  const key = category.toLowerCase() as FilmstripCategory;
  return FILMSTRIP_BY_CATEGORY[key] ?? FILMSTRIP_BY_CATEGORY.default;
}
