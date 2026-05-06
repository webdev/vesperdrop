import { describe, it, expect } from "vitest";
import { parseEtsyCandidatesMd } from "./parse-md";

const SAMPLE = `# Etsy garments — flat / hanger / dress-form listings

Curated 2026-05-05.

---

## 1. [Vintage Bill Blass Corduroy Pinafore Dress](https://www.etsy.com/listing/4415836244/foo)

![Vintage Bill Blass Corduroy Pinafore Dress](https://i.etsystatic.com/abc/il_765x1020.jpg)

_Surfaced via search: vintage dress_

## 2. [Title with no image](https://www.etsy.com/listing/123/bar)

_Surfaced via search: vintage blouse_

## 3. [Malformed listing — no link

![orphan image](https://i.etsystatic.com/x.jpg)

## 4. [Final entry](https://www.etsy.com/listing/999/baz)

![Final entry](https://i.etsystatic.com/y.jpg)
`;

describe("parseEtsyCandidatesMd", () => {
  it("parses well-formed entries", () => {
    const { candidates, errors } = parseEtsyCandidatesMd(SAMPLE);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      title: "Vintage Bill Blass Corduroy Pinafore Dress",
      listingUrl: "https://www.etsy.com/listing/4415836244/foo",
      imageUrl: "https://i.etsystatic.com/abc/il_765x1020.jpg",
      category: "vintage dress",
    });
    expect(candidates[0].rawMd).toContain("Vintage Bill Blass");
  });

  it("captures category for second entry even though image missing", () => {
    const { candidates } = parseEtsyCandidatesMd(SAMPLE);
    const second = candidates.find(
      (c) => c.listingUrl === "https://www.etsy.com/listing/123/bar",
    );
    expect(second).toBeDefined();
    expect(second?.imageUrl).toBeNull();
    expect(second?.category).toBe("vintage blouse");
  });

  it("records an error for the malformed block but keeps parsing", () => {
    const { candidates, errors } = parseEtsyCandidatesMd(SAMPLE);
    expect(candidates.map((c) => c.title)).toContain("Final entry");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]?.reason).toMatch(/heading/i);
  });

  it("handles empty input", () => {
    const { candidates, errors } = parseEtsyCandidatesMd("");
    expect(candidates).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});
