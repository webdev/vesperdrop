import "server-only";
import sharp from "sharp";

export async function applyWatermark(input: Buffer, label: string): Promise<Buffer> {
  const { width = 1024, height = 1024 } = await sharp(input).metadata();
  const fontSize = Math.round(Math.min(width, height) / 18);
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <pattern id="wm" patternUnits="userSpaceOnUse" width="${width}" height="${fontSize * 4}" patternTransform="rotate(-30)">
           <text x="0" y="${fontSize * 1.5}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="rgba(255,255,255,0.35)" stroke="rgba(0,0,0,0.25)" stroke-width="1">${label}</text>
         </pattern>
       </defs>
       <rect width="100%" height="100%" fill="url(#wm)"/>
     </svg>`,
  );
  return sharp(input).composite([{ input: svg, blend: "over" }]).toBuffer();
}
