import { describe, it, expect } from "vitest";
import { failureHeadline, failureBody } from "./credit-error-copy";

describe("credit-error-copy", () => {
  it("maps credit_limit_reached to the §15a-locked headline", () => {
    // "Out of free renders" is locked copy (CLAUDE.md §15a) — never reword.
    expect(failureHeadline("credit_limit_reached")).toBe("Out of free renders");
  });

  it("maps quota_exhausted to the authed out-of-credits headline", () => {
    expect(failureHeadline("quota_exhausted")).toBe("Out of credits");
  });

  it("falls back to a generic headline for unknown / missing codes", () => {
    expect(failureHeadline("some_transient_thing")).toBe("Generation failed");
    expect(failureHeadline(undefined)).toBe("Generation failed");
  });

  it("returns the device-cap body for credit_limit_reached", () => {
    expect(failureBody("credit_limit_reached")).toBe(
      "You've used your 3 free renders on this device. Sign up to keep generating.",
    );
  });

  it("returns the plan-credits body for quota_exhausted", () => {
    expect(failureBody("quota_exhausted")).toBe(
      "You've used every credit on your plan. Upgrade to keep generating.",
    );
  });

  it("inlines the underlying message for generic failures when present", () => {
    expect(failureBody(undefined, "model timed out")).toBe(
      "model timed out. Try a different scene or refresh to retry.",
    );
  });

  it("falls back to a generic body when no message is available", () => {
    expect(failureBody(undefined)).toBe(
      "We couldn't develop this shot. Try a different scene or refresh to retry.",
    );
  });
});
