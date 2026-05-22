import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MobileNavSheet } from "./mobile-nav-sheet";

afterEach(cleanup);

const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// base-ui Dialog doesn't run in jsdom — replace primitives with plain HTML wrappers.
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Trigger: ({
      children,
      ...props
    }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
      <button {...props}>{children}</button>
    ),
    Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Backdrop: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    Popup: ({
      children,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    Close: ({
      children,
      ...props
    }: React.PropsWithChildren<
      React.ButtonHTMLAttributes<HTMLButtonElement>
    >) => <button {...props}>{children}</button>,
  },
}));

describe("MobileNavSheet — content (VES-6)", () => {
  it("renders a hamburger trigger button", () => {
    render(
      <MobileNavSheet
        isSignedIn={false}
        credits={null}
        isAdmin={false}
        firstName={null}
        email=""
      />,
    );
    expect(screen.getByTestId("hamburger-button")).toBeInTheDocument();
  });

  describe("unauth state", () => {
    beforeEach(() => {
      render(
        <MobileNavSheet
          isSignedIn={false}
          credits={null}
          isAdmin={false}
          firstName={null}
          email=""
        />,
      );
    });

    it("shows 'First photo free' CTA link", () => {
      expect(
        screen.getByRole("link", { name: /first photo free/i }),
      ).toBeInTheDocument();
    });

    it("shows Discover link", () => {
      expect(
        screen.getByRole("link", { name: /discover/i }),
      ).toBeInTheDocument();
    });

    it("shows Pricing link", () => {
      expect(
        screen.getByRole("link", { name: /pricing/i }),
      ).toBeInTheDocument();
    });

    it("shows 'How it works' link", () => {
      expect(
        screen.getByRole("link", { name: /how it works/i }),
      ).toBeInTheDocument();
    });

    it("shows Sign in link", () => {
      expect(
        screen.getByRole("link", { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it("does NOT show Library, Styles, or Account links", () => {
      expect(screen.queryByRole("link", { name: /^library$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^styles$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^account$/i })).toBeNull();
    });
  });

  describe("authed, non-admin", () => {
    beforeEach(() => {
      render(
        <MobileNavSheet
          isSignedIn={true}
          credits={12}
          isAdmin={false}
          firstName="Alice"
          email="alice@example.com"
        />,
      );
    });

    it("shows Library, Styles, Account, Discover, Pricing", () => {
      expect(
        screen.getByRole("link", { name: /^library$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^styles$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^account$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^discover$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /^pricing$/i }),
      ).toBeInTheDocument();
    });

    it("does NOT show Admin link", () => {
      expect(screen.queryByRole("link", { name: /^admin$/i })).toBeNull();
    });

    it("shows credit count in footer", () => {
      expect(screen.getByTestId("sheet-footer")).toHaveTextContent("12");
    });

    it("shows Sign out button", () => {
      expect(
        screen.getByRole("button", { name: /sign out/i }),
      ).toBeInTheDocument();
    });
  });

  describe("authed, admin", () => {
    beforeEach(() => {
      render(
        <MobileNavSheet
          isSignedIn={true}
          credits={null}
          isAdmin={true}
          firstName="George"
          email="gblazer@gmail.com"
        />,
      );
    });

    it("shows Admin link when isAdmin=true", () => {
      expect(
        screen.getByRole("link", { name: /^admin$/i }),
      ).toBeInTheDocument();
    });

    it("shows ∞ in footer for admins", () => {
      expect(screen.getByTestId("sheet-footer")).toHaveTextContent("∞");
    });
  });

  it("usePathname is called (so route-change close effect is wired)", () => {
    render(
      <MobileNavSheet
        isSignedIn={false}
        credits={null}
        isAdmin={false}
        firstName={null}
        email=""
      />,
    );
    expect(mockPathname).toHaveBeenCalled();
  });
});
