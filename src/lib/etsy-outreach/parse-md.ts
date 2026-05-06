export type ParsedCandidate = {
  title: string;
  listingUrl: string;
  imageUrl: string | null;
  category: string | null;
  rawMd: string;
};

export type ParseError = { reason: string; rawMd: string };

const HEADING_RE = /^##\s+\d+\.\s+\[([^\]]+)\]\(([^)]+)\)\s*$/;
const IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/;
const CATEGORY_RE = /_Surfaced via search:\s*([^_]+?)_/;

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
    const [, title, listingUrl] = headingMatch;
    const imageMatch = IMAGE_RE.exec(block);
    const categoryMatch = CATEGORY_RE.exec(block);
    candidates.push({
      title: title.trim(),
      listingUrl: listingUrl.trim(),
      imageUrl: imageMatch ? imageMatch[1].trim() : null,
      category: categoryMatch ? categoryMatch[1].trim() : null,
      rawMd: block.trim(),
    });
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
