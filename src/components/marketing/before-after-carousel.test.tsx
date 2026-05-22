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

describe("BeforeAfterCarousel — mobile toggle (VES-8)", () => {
  it("renders without crashing", () => {
    render(<BeforeAfterCarousel />);
    expect(screen.getByTestId("mobile-card")).toBeInTheDocument();
  });

  it("shows After as active by default (aria-pressed=true on After btn)", () => {
    render(<BeforeAfterCarousel />);
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking Before toggles aria-pressed on both buttons", () => {
    render(<BeforeAfterCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking After reverts to After active", () => {
    render(<BeforeAfterCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    fireEvent.click(screen.getByRole("button", { name: /show after/i }));
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves per-slide showBefore state across navigation", () => {
    render(<BeforeAfterCarousel />);

    // Toggle slide 0 → Before
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // Navigate to slide 1
    const dots = screen.getAllByRole("tab");
    fireEvent.click(dots[1]);

    // Slide 1 starts as After
    expect(
      screen.getByRole("button", { name: /show after/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // Navigate back to slide 0 — should still be Before
    fireEvent.click(dots[0]);
    expect(
      screen.getByRole("button", { name: /show before/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("'tap to compare' hint is visible initially", () => {
    render(<BeforeAfterCarousel />);
    const hint = screen.getByTestId("compare-hint");
    expect(hint.className).toContain("opacity-100");
  });

  it("'tap to compare' hint fades after first toggle", () => {
    render(<BeforeAfterCarousel />);
    fireEvent.click(screen.getByRole("button", { name: /show before/i }));
    const hint = screen.getByTestId("compare-hint");
    expect(hint.className).toContain("opacity-0");
  });

  it("toggle buttons are <button> elements with aria-pressed (keyboard accessible)", () => {
    render(<BeforeAfterCarousel />);
    const afterBtn = screen.getByRole("button", { name: /show after/i });
    const beforeBtn = screen.getByRole("button", { name: /show before/i });
    expect(afterBtn.tagName).toBe("BUTTON");
    expect(beforeBtn.tagName).toBe("BUTTON");
    expect(afterBtn).toHaveAttribute("aria-pressed");
    expect(beforeBtn).toHaveAttribute("aria-pressed");
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

  it("'tap to compare' hint dismisses on pointerDown (any drag interaction)", () => {
    render(<BeforeAfterCarousel />);
    const hint = screen.getByTestId("compare-hint");
    expect(hint.className).toContain("opacity-100");

    const card = screen.getByTestId("card-image-area");
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 80, buttons: 1 });

    expect(hint.className).toContain("opacity-0");
  });

  it("drag crossing left of center (< 50%) snaps to Before on pointerUp", () => {
    render(<BeforeAfterCarousel />);

    const card = screen.getByTestId("card-image-area");

    // Mock getBoundingClientRect so width is 200px, left 0
    vi.spyOn(card as any, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 300, width: 200, height: 300,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect);

    // Start in After state
    expect(screen.getByRole("button", { name: /show after/i })).toHaveAttribute("aria-pressed", "true");

    // Drag: pointerDown, move to clientX=40 (40/200 = 20%, left of center), pointerUp
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, buttons: 1 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 40, buttons: 1 });
    fireEvent.pointerUp(card, { pointerId: 1 });

    // Should have snapped to Before
    expect(screen.getByRole("button", { name: /show before/i })).toHaveAttribute("aria-pressed", "true");
  });
});
