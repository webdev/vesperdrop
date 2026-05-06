export type ParsedCandidate = {
  title: string;
  listingUrl: string;
  imageUrl: string | null;
  category: string | null;
  shopName: string | null;
  shopUrl: string | null;
  rawMd: string;
};

export type ParseError = { reason: string; rawMd: string };

const HEADING_RE = /^##\s+\d+\.\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:—\s*(.+))?$/;
const IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/;
const CATEGORY_RE = /_Surfaced via search:\s*([^_]+?)_/;
const SAMPLE_LISTING_RE = /\*\*Sample listing:\*\*\s+\[([^\]]+)\]\(([^)]+)\)/;

export function parseEtsyCandidatesMd(input: string): {
  candidates: ParsedCandidate[];
  errors: ParseError[];
} {
  const candidates: ParsedCandidate[] = [];
  const errors: ParseError[] = [];

  if (!input.trim()) return { candidates, errors };

  const blocks = splitBlocks(input);
  for (const block of blocks) {
    const headingLine = block.split("\n").find((l) => l.startsWith("## "));
    if (!headingLine) continue;
    const headingMatch = HEADING_RE.exec(headingLine);
    if (!headingMatch) {
      errors.push({
        reason: `Could not parse heading: ${headingLine}`,
        rawMd: block,
      });
      continue;
    }
    const [, linkText, linkHref, afterDash] = headingMatch;
    const imageMatch = IMAGE_RE.exec(block);

    if (linkHref.includes("/shop/")) {
      // Sellers pilot format
      const sampleMatch = SAMPLE_LISTING_RE.exec(block);
      if (!sampleMatch) {
        errors.push({
          reason: `Could not find sample listing in sellers block: ${headingLine}`,
          rawMd: block,
        });
        continue;
      }
      const [, sampleTitle, sampleUrl] = sampleMatch;
      candidates.push({
        title: sampleTitle.trim(),
        listingUrl: sampleUrl.trim(),
        imageUrl: imageMatch ? imageMatch[1].trim() : null,
        category: afterDash ? afterDash.trim() : null,
        shopName: linkText.trim(),
        shopUrl: linkHref.trim(),
        rawMd: block.trim(),
      });
    } else {
      // Listings format
      const categoryMatch = CATEGORY_RE.exec(block);
      candidates.push({
        title: linkText.trim(),
        listingUrl: linkHref.trim(),
        imageUrl: imageMatch ? imageMatch[1].trim() : null,
        category: categoryMatch ? categoryMatch[1].trim() : null,
        shopName: null,
        shopUrl: null,
        rawMd: block.trim(),
      });
    }
  }

  return { candidates, errors };
}

function splitBlocks(input: string): string[] {
  const lines = input.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^##\s+\d+\./.test(line)) {
      if (current.length > 0) blocks.push(current.join("\n"));
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}
