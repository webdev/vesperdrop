import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { DevelopGrid, type TileResult } from "./develop-grid";

afterEach(cleanup);

// Stub framer-motion. motion.* must return a STABLE component
// reference per tag — recreating it on each Proxy access makes React
// treat every render as a new component type, which tanks reconciler
// state and breaks queries that resolve after the first render.
vi.mock("framer-motion", () => {
  const MOTION_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "layout",
    "whileHover",
    "whileTap",
    "variants",
  ]);
  const cache = new Map<string, React.FC<Record<string, unknown>>>();
  const motion = new Proxy(
    {},
    {
      get: (_, prop: string) => {
        const hit = cache.get(prop);
        if (hit) return hit;
        const Comp: React.FC<Record<string, unknown>> = ({
          children,
          ...props
        }) => {
          const Tag = prop as keyof React.JSX.IntrinsicElements;
          const stripped: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (!MOTION_PROPS.has(k)) stripped[k] = v;
          }
          return <Tag {...stripped}>{children as React.ReactNode}</Tag>;
        };
        Comp.displayName = `motion.${prop}`;
        cache.set(prop, Comp);
        return Comp;
      },
    },
  );
  const AnimatePresence = ({ children }: React.PropsWithChildren) => (
    <>{children}</>
  );
  return { motion, AnimatePresence };
});

function makeTile(
  overrides: Partial<TileResult> = {},
  idx = 0,
): TileResult {
  return {
    sceneSlug: `scene-${idx}`,
    sceneName: `Scene ${idx}`,
    status: "succeeded",
    outputUrl: `https://example.test/img-${idx}.png`,
    rawUrl: `https://example.test/raw-${idx}.png`,
    isFreePreview: idx === 0,
    softLocked: idx !== 0,
    ...overrides,
  };
}

describe("DevelopGrid editorial — tile click → onPreviewClick", () => {
  it("fires onPreviewClick when the user clicks the tile body", async () => {
    const onPreviewClick = vi.fn();
    const onDownloadClick = vi.fn();
    const onUnlockClick = vi.fn();

    render(
      <DevelopGrid
        results={[makeTile({}, 0)]}
        editorial
        onPreviewClick={onPreviewClick}
        onDownloadClick={onDownloadClick}
        onUnlockClick={onUnlockClick}
      />,
    );

    const tile = await screen.findByTestId("develop-tile");
    // Click the role=button wrapper (the click target the tile sets
    // up). Querying the DOM directly avoids tripping over the inner
    // image's pointer-events.
    const clickable = tile.querySelector('[role="button"]');
    expect(clickable).not.toBeNull();
    fireEvent.click(clickable as HTMLElement);

    expect(onPreviewClick).toHaveBeenCalledTimes(1);
    expect(onPreviewClick).toHaveBeenCalledWith("scene-0");
    // The body click must NOT also fire the download/unlock paths —
    // those have their own buttons with stopPropagation.
    expect(onDownloadClick).not.toHaveBeenCalled();
    expect(onUnlockClick).not.toHaveBeenCalled();
  });

  it("fires onPreviewClick for soft-locked tiles too (so preview is consistent)", async () => {
    const onPreviewClick = vi.fn();

    render(
      <DevelopGrid
        results={[makeTile({}, 1)]}
        editorial
        onPreviewClick={onPreviewClick}
        onDownloadClick={vi.fn()}
        onUnlockClick={vi.fn()}
      />,
    );

    const tile = await screen.findByTestId("develop-tile");
    const clickable = tile.querySelector('[role="button"]');
    fireEvent.click(clickable as HTMLElement);

    expect(onPreviewClick).toHaveBeenCalledWith("scene-1");
  });

  it("fires onPreviewClick when paidAll is on (every tile unlocked)", async () => {
    const onPreviewClick = vi.fn();

    render(
      <DevelopGrid
        results={[
          makeTile({}, 0),
          makeTile({ softLocked: false }, 1),
          makeTile({ softLocked: false }, 2),
        ]}
        editorial
        paidAll
        onPreviewClick={onPreviewClick}
        onDownloadClick={vi.fn()}
      />,
    );

    const tiles = await screen.findAllByTestId("develop-tile");
    for (const t of tiles) {
      const clickable = t.querySelector('[role="button"]');
      fireEvent.click(clickable as HTMLElement);
    }

    expect(onPreviewClick).toHaveBeenCalledTimes(3);
    expect(onPreviewClick.mock.calls.map((c) => c[0])).toEqual([
      "scene-0",
      "scene-1",
      "scene-2",
    ]);
  });

  it("Download pill click fires onDownloadClick but NOT onPreviewClick", async () => {
    const onPreviewClick = vi.fn();
    const onDownloadClick = vi.fn();

    render(
      <DevelopGrid
        results={[makeTile({}, 0)]}
        editorial
        onPreviewClick={onPreviewClick}
        onDownloadClick={onDownloadClick}
      />,
    );

    const downloadCta = await screen.findByTestId("tile-download-cta");
    fireEvent.click(downloadCta);

    expect(onDownloadClick).toHaveBeenCalledWith("scene-0");
    expect(onPreviewClick).not.toHaveBeenCalled();
  });

  it("falls back to onDownloadClick when onPreviewClick is NOT provided (the /try in-flow case)", async () => {
    // try-flow.tsx doesn't pass onPreviewClick; clicking the body
    // there should still route to onDownloadClick (which gates on
    // auth and opens the AuthModal). This test pins that contract
    // so the new BatchView lightbox routing doesn't accidentally
    // break the existing /try flow.
    const onDownloadClick = vi.fn();

    render(
      <DevelopGrid
        results={[makeTile({}, 0)]}
        editorial
        onDownloadClick={onDownloadClick}
        // no onPreviewClick
      />,
    );

    const tile = await screen.findByTestId("develop-tile");
    const clickable = tile.querySelector('[role="button"]');
    fireEvent.click(clickable as HTMLElement);

    expect(onDownloadClick).toHaveBeenCalledWith("scene-0");
  });
});
