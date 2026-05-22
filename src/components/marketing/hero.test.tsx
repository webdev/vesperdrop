import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Hero } from "./hero";

afterEach(cleanup);

vi.mock("./before-after-carousel", () => ({
  BeforeAfterCarousel: () => <div data-testid="carousel-mock" />,
}));

describe("Hero — mobile compression (VES-7)", () => {
  it("renders exactly one <h1>", () => {
    render(<Hero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("h1 contains the mobile copy", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Apparel photos that look/i,
    );
  });

  it("h1 contains the desktop copy", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Lifestyle photography that makes your apparel look/i,
    );
  });

  it("'See how it works' link has the hidden class (mobile-hidden)", () => {
    render(<Hero />);
    const link = screen.getByRole("link", { name: /see how it works/i });
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("md:inline-flex");
  });

  it("renders the carousel before the stat strip in DOM order", () => {
    const { container } = render(<Hero />);
    const carousel = screen.getByTestId("carousel-mock");
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
    expect(
      carousel.compareDocumentPosition(dl!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("primary CTA links to /try", () => {
    render(<Hero />);
    expect(
      screen.getByRole("link", { name: /get my first photo free/i }),
    ).toHaveAttribute("href", "/try");
  });
});
