import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PALETTES: Record<string, string[]> = {
  exterior: ["#5b6f4e", "#7a8a66", "#a5af8c", "#c8cfb1", "#e3e6cd"],
  interior: ["#a78b6e", "#c0a584", "#d4bd9b", "#e6d2b3", "#f0e2c9"],
  street:   ["#2f2f33", "#4a4a52", "#6e6e7a", "#9a9aa8", "#c4c4d0"],
  studio:   ["#f4f0e8", "#e8e3d6", "#d4ccba", "#bfb59c", "#a89c80"],
  default:  ["#cfcabf", "#bdb7a8", "#a89f8a", "#928871", "#766c57"],
};

async function main() {
  for (const [category, hexes] of Object.entries(PALETTES)) {
    const dir = path.join("public", "filmstrip", category);
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < hexes.length; i++) {
      const buf = await sharp({
        create: {
          width: 160,
          height: 160,
          channels: 3,
          background: hexes[i],
        },
      }).jpeg({ quality: 78 }).toBuffer();
      await writeFile(path.join(dir, `${String(i + 1).padStart(2, "0")}.jpg`), buf);
    }
  }
  console.log("filmstrip fallback generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
