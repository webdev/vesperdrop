import { ImageResponse } from "next/og";
import { getPreviewByToken } from "@/lib/etsy-outreach/pages";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await getPreviewByToken(token);
  const url = page?.heroUrl ?? page?.lifestyleUrl ?? page?.detailUrl;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f5efe6",
          color: "#1f1a17",
          fontFamily: "serif",
          padding: 64,
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 32, opacity: 0.6 }}>Vesperdrop</div>
          <div style={{ fontSize: 64, lineHeight: 1.05, marginTop: 24 }}>
            Your product on Shopify.
          </div>
        </div>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" width={500} height={500} style={{ borderRadius: 24, objectFit: "cover" }} />
        ) : null}
      </div>
    ),
    size,
  );
}
