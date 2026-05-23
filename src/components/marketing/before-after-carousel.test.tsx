import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BeforeAfterCarousel } from "./before-after-carousel";

afterEach(cleanup);

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

function mockCardRect(card: HTMLElement, width = 200) {
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: width,
    bottom: 300,
    width,
    height: 300,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect);
}

describe("BeforeAfterCarousel — mobile split slider (VES-33)", () => {
  it("renders without crashing", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.getByTestId("mobile-card")).toBeInTheDocument();
  });

  it("renders both before and after images simultaneously by default (TC-3.1)", () => {
    render(<BeforeAfterCarousel />);
    // Both the mobile split card and the (CSS-hidden) desktop grid mount,
    // so each alt appears twice — what matters is that both are present.
    expect(
      screen.getAllByAltText(/Cami — flat lay before Vesperdrop/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByAltText(/Cami — on-model lifestyle photo/i).length,
    ).toBeGreaterThan(0);
  });

  it("split handle is a slider at 50% by default", () => {
    render(<BeforeAfterCarousel />);
    const handle = screen.getByTestId("split-handle");
    expect(handle).toHaveAttribute("role", "slider");
    expect(handle).toHaveAttribute("aria-valuemin", "0");
    expect(handle).toHaveAttribute("aria-valuemax", "100");
    expect(handle).toHaveAttribute("aria-valuenow", "50");
    expect(handle).toHaveAttribute("aria-label", "Compare before and after");
  });

  it("drag updates split continuously and does not snap on release (TC-3.2)", () => {
    render(<BeforeAfterCarousel />);
    const card = screen.getByTestId("card-image-area");
    const handle = screen.getByTestId("split-handle");
    mockCardRect(card, 200);

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, buttons: 1 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 40, buttons: 1 });
    expect(handle).toHaveAttribute("aria-valuenow", "20");

    fireEvent.pointerUp(card, { pointerId: 1 });
    // Released at 20% — must NOT snap to 0/100.
    expect(handle).toHaveAttribute("aria-valuenow", "20");
  });

  it("drag clamps to [0,100] when pointer leaves the card bounds", () => {
    render(<BeforeAfterCarousel />);
    const card = screen.getByTestId("card-image-area");
    const handle = screen.getByTestId("split-handle");
    mockCardRect(card, 200);

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, buttons: 1 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: -50, buttons: 1 });
    expect(handle).toHaveAttribute("aria-valuenow", "0");

    fireEvent.pointerMove(card, { pointerId: 1, clientX: 999, buttons: 1 });
    expect(handle).toHaveAttribute("aria-valuenow", "100");
    fireEvent.pointerUp(card, { pointerId: 1 });
  });

  it("ArrowLeft / ArrowRight nudge split by 5% (TC-3.3)", () => {
    render(<BeforeAfterCarousel />);
    const handle = screen.getByTestId("split-handle");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "45");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle).toHaveAttribute("aria-valuenow", "35");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "40");
  });

  it("Home / End jump to 0 and 100", () => {
    render(<BeforeAfterCarousel />);
    const handle = screen.getByTestId("split-handle");
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAttribute("aria-valuenow", "100");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders all three pills with correct copy and class colors (TC-3.4)", () => {
    render(<BeforeAfterCarousel />);
    const card = screen.getByTestId("card-image-area");
    const vesperdrop = card.querySelector(
      'span.bg-ink\\/85',
    ) as HTMLElement | null;
    expect(vesperdrop?.textContent?.toLowerCase()).toContain("vesperdrop");

    const rawPill = card.querySelector(
      'span.bg-cream\\/95',
    ) as HTMLElement | null;
    expect(rawPill?.textContent?.toLowerCase()).toContain("raw product");

    const readyPill = card.querySelector(
      'span.bg-terracotta',
    ) as HTMLElement | null;
    expect(readyPill?.textContent?.toLowerCase()).toContain("ready to list");
  });

  it("does NOT render the deprecated After/Before toggle pill (TC-3.5)", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.queryByRole("button", { name: /show after/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /show before/i })).toBeNull();
  });

  it("does NOT render the deprecated 'Tap to compare' hint", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.queryByTestId("compare-hint")).toBeNull();
  });

  it("preserves per-slide split position across slide navigation (TC-3.8)", () => {
    render(<BeforeAfterCarousel />);
    const card = screen.getByTestId("card-image-area");
    const handle = screen.getByTestId("split-handle");
    mockCardRect(card, 200);

    // Drag slide 0 to 20%
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, buttons: 1 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 40, buttons: 1 });
    fireEvent.pointerUp(card, { pointerId: 1 });
    expect(handle).toHaveAttribute("aria-valuenow", "20");

    // Switch to slide 1 — opens at default 50.
    const dots = screen.getAllByRole("tab");
    fireEvent.click(dots[1]);
    const handle1 = screen.getByTestId("split-handle");
    expect(handle1).toHaveAttribute("aria-valuenow", "50");

    // Back to slide 0 — retains 20.
    fireEvent.click(dots[0]);
    const handle0 = screen.getByTestId("split-handle");
    expect(handle0).toHaveAttribute("aria-valuenow", "20");
  });

  it("renders 4 dot-nav tabs", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("shows label and scene for the first slide", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.getByText(/cami/i)).toBeInTheDocument();
    expect(screen.getByText(/velvet glow/i)).toBeInTheDocument();
  });

  it("handle is keyboard focusable (tabIndex=0)", () => {
    render(<BeforeAfterCarousel />);
    const handle = screen.getByTestId("split-handle");
    expect(handle.tabIndex).toBe(0);
  });
});
