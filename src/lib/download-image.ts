export class DownloadUpgradeRequiredError extends Error {
  constructor() {
    super("downloads_require_upgrade");
    this.name = "DownloadUpgradeRequiredError";
  }
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

export async function downloadImage(generationId: string) {
  const res = await fetch(`/api/images/${generationId}?download=1`);
  if (res.status === 402) {
    throw new DownloadUpgradeRequiredError();
  }
  if (!res.ok) {
    throw new Error(`download failed (${res.status})`);
  }

  const blob = await res.blob();
  const filename = filenameFromDisposition(
    res.headers.get("content-disposition"),
    `vesperdrop-${generationId}.png`,
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
