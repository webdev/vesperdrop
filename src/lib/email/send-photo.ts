import "server-only";
import { env } from "@/lib/env";
import { getResendClient } from "./client";

export type PhotoForEmail = {
  presetId: string;
  url: string;
};

export type SendPhotosParams = {
  to: string;
  photos: PhotoForEmail[];
  batchUrl?: string;
};

export type SendPhotosResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_api_key" | "send_failed"; message?: string };

/**
 * Delivers the watermark-free hero + supporting shots to a visitor who
 * submitted the inline /try email capture. Returns ok:false rather than
 * throwing so the API route can branch on failure mode (503 vs 5xx)
 * without leaking provider stack traces.
 */
export async function sendPhotosEmail(
  params: SendPhotosParams,
): Promise<SendPhotosResult> {
  const client = getResendClient();
  if (!client) return { ok: false, reason: "no_api_key" };

  const count = params.photos.length;
  const subject =
    count === 1
      ? "Your Vesperdrop photo — watermark-free"
      : `Your ${count} Vesperdrop photos — watermark-free`;

  const html = renderPhotosEmail(params);
  const text = renderPhotosEmailText(params);

  const result = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject,
    html,
    text,
  });

  if (result.error || !result.data?.id) {
    return {
      ok: false,
      reason: "send_failed",
      message: result.error?.message,
    };
  }
  return { ok: true, id: result.data.id };
}

function renderPhotosEmail(p: SendPhotosParams): string {
  const photoBlocks = p.photos
    .map((photo) => {
      return `
            <tr>
              <td style="padding:12px 32px">
                <p style="margin:0 0 6px;font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#8a8076">${escapeHtml(photo.presetId)}</p>
                <a href="${escapeAttr(photo.url)}">
                  <img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.presetId)}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border-radius:8px;border:1px solid #ece7df" />
                </a>
                <p style="margin:6px 0 0;word-break:break-all"><a href="${escapeAttr(photo.url)}" style="color:#c65f3d;text-decoration:underline;font-size:12px">Download HD</a></p>
              </td>
            </tr>`;
    })
    .join("\n");

  const batchCta = p.batchUrl
    ? `<p style="margin:24px 0 0;text-align:center">
        <a href="${escapeAttr(p.batchUrl)}" style="display:inline-block;background:#c65f3d;color:#faf7f0;text-decoration:none;padding:14px 24px;border-radius:999px;font-family:'JetBrains Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.12em">Generate more →</a>
      </p>`
    : "";

  const headlineCount = p.photos.length === 1 ? "Your photo" : `All ${p.photos.length} photos`;

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#faf7f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a221c">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#faf7f0;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#fff;border:1px solid #ece7df;border-radius:12px;overflow:hidden">
            <tr>
              <td style="padding:28px 32px 8px">
                <p style="margin:0;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#8a8076">Vesperdrop · First photo free</p>
                <h1 style="margin:12px 0 4px;font-family:'Fraunces',Georgia,serif;font-size:28px;line-height:1.1;letter-spacing:-0.01em;color:#2a221c">${headlineCount}, watermark-free.</h1>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:#5b5249">Right-click any image (long-press on mobile) to save the full-resolution file, or use the download links below each shot.</p>
              </td>
            </tr>
            ${photoBlocks}
            <tr>
              <td style="padding:8px 32px 28px">
                ${batchCta}
                <p style="margin:24px 0 0;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#8a8076;text-align:center">Reply to this email if anything looks off — a human reads every reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderPhotosEmailText(p: SendPhotosParams): string {
  const lines = [
    `Your ${p.photos.length} Vesperdrop photo${p.photos.length === 1 ? "" : "s"} — watermark-free, on us.`,
    "",
  ];
  for (const photo of p.photos) {
    lines.push(`${photo.presetId}: ${photo.url}`);
  }
  if (p.batchUrl) {
    lines.push("", `Generate more: ${p.batchUrl}`);
  }
  lines.push(
    "",
    "Reply if anything looks off — a human reads every reply.",
  );
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
