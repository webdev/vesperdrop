import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireCompleteRegistration,
  isNewGoogleRegistration,
  type OAuthUserSignal,
} from "./meta-pixel";

describe("isNewGoogleRegistration", () => {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const googleUser = (over: Partial<OAuthUserSignal> = {}): OAuthUserSignal => ({
    id: "u1",
    created_at: iso(now),
    last_sign_in_at: iso(now),
    app_metadata: { provider: "google", providers: ["google"] },
    identities: [{ provider: "google" }],
    ...over,
  });

  it("fires for a brand-new Google account (created_at ≈ last_sign_in_at)", () => {
    expect(isNewGoogleRegistration(googleUser())).toBe(true);
  });

  it("fires when created_at and last_sign_in_at are seconds apart", () => {
    const user = googleUser({
      created_at: iso(now),
      last_sign_in_at: iso(now + 2_000),
    });
    expect(isNewGoogleRegistration(user)).toBe(true);
  });

  it("does NOT fire for a returning Google user (last_sign_in_at well after created_at)", () => {
    const user = googleUser({
      created_at: iso(now - 1000 * 60 * 60 * 24 * 30), // 30 days ago
      last_sign_in_at: iso(now),
    });
    expect(isNewGoogleRegistration(user)).toBe(false);
  });

  it("fires when last_sign_in_at is absent (freshly created, never re-signed-in)", () => {
    const user = googleUser({ last_sign_in_at: null });
    expect(isNewGoogleRegistration(user)).toBe(true);
  });

  it("does NOT fire for a non-Google (email+password) account, even if new", () => {
    const user = googleUser({
      app_metadata: { provider: "email", providers: ["email"] },
      identities: [{ provider: "email" }],
    });
    expect(isNewGoogleRegistration(user)).toBe(false);
  });

  it("detects Google via identities when app_metadata.provider differs", () => {
    const user = googleUser({
      app_metadata: { provider: "email", providers: ["email", "google"] },
    });
    expect(isNewGoogleRegistration(user)).toBe(true);
  });

  it("does NOT fire without a created_at", () => {
    const user = googleUser({ created_at: undefined });
    expect(isNewGoogleRegistration(user)).toBe(false);
  });

  it("respects a custom window", () => {
    const user = googleUser({
      created_at: iso(now),
      last_sign_in_at: iso(now + 5_000),
    });
    expect(isNewGoogleRegistration(user, 1_000)).toBe(false);
    expect(isNewGoogleRegistration(user, 10_000)).toBe(true);
  });
});

describe("fireCompleteRegistration", () => {
  const fbq = vi.fn();

  beforeEach(() => {
    fbq.mockReset();
    (globalThis as unknown as { window: { fbq: typeof fbq } }).window = {
      fbq,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("fires the exact CompleteRegistration shape with a deterministic eventID", () => {
    fireCompleteRegistration({
      userId: "abc",
      method: "google",
      seed: 1717000000000,
    });
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "CompleteRegistration",
      {
        content_name: "download_signup",
        method: "google",
        value: 0,
        currency: "USD",
      },
      { eventID: "reg-abc-1717000000000" },
    );
  });

  it("uses email_password method when specified", () => {
    fireCompleteRegistration({ userId: "u2", method: "email_password", seed: 1 });
    expect(fbq.mock.calls[0]?.[2]).toMatchObject({ method: "email_password" });
  });

  it("falls back to Date.now() for the eventID seed when none is given", () => {
    const before = Date.now();
    fireCompleteRegistration({ userId: "u3", method: "google" });
    const eventID = (fbq.mock.calls[0]?.[3] as { eventID: string }).eventID;
    const seed = Number(eventID.replace("reg-u3-", ""));
    expect(seed).toBeGreaterThanOrEqual(before);
  });

  it("no-ops when fbq is absent (Pixel blocked / not yet loaded)", () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {};
    expect(() =>
      fireCompleteRegistration({ userId: "x", method: "google" }),
    ).not.toThrow();
  });

  it("no-ops outside the browser (no window)", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(() =>
      fireCompleteRegistration({ userId: "x", method: "google" }),
    ).not.toThrow();
  });
});
