"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Client-side download button. The <a download> attribute is ignored
 * when the URL is cross-origin (Vercel Blob) and the response doesn't
 * set Content-Disposition: attachment, so the browser opens the
 * image in a new tab. Fetch the URL as a blob and trigger the
 * download through an object URL — same-origin from the browser's
 * view, so the download attribute is honored and the file saves.
 */
export function DownloadButton({
  url,
  filename,
  children = "Download HD",
}: {
  url: string;
  filename: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("[unlocked] download failed", err);
      // Fallback: open in a new tab so the user can right-click → save.
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="accent" onClick={onClick} disabled={busy}>
      {busy ? "Saving…" : children}
    </Button>
  );
}
