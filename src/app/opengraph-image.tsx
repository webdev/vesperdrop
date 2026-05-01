import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Vesperdrop — lifestyle photography, generated.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#faf7f0",
          color: "#1b1915",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#7a7268",
          }}
        >
          Lifestyle photography · generated · on demand
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 132,
              lineHeight: 1,
              fontStyle: "italic",
              fontFamily: "serif",
              letterSpacing: -2,
            }}
          >
            Vesperdrop
          </div>
          <div
            style={{
              fontSize: 38,
              lineHeight: 1.2,
              maxWidth: 900,
              color: "#3d362d",
              fontFamily: "serif",
            }}
          >
            Drop a product photo. Get a library of lifestyle shots — ready for
            Amazon, Shopify, and ads.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 18,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#7a7268",
          }}
        >
          <span>vesperdrop.com</span>
          <span style={{ color: "#c2451c" }}>1 free HD shot · no card</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
