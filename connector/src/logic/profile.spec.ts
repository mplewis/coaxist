import { describe, expect, it } from "vitest";
import { Profile, satisfiesQuality } from "./profile";
import { Classification } from "./classify";

describe("satisfiesQuality", () => {
  it("returns the expected results", () => {
    const item: Pick<Classification, "quality"> = { quality: "1080p" };
    const examples: {
      criteria: Pick<Profile, "minimum" | "maximum">;
      expected: boolean;
    }[] = [
      { criteria: {}, expected: true },
      { criteria: { minimum: { quality: "1080p" } }, expected: true },
      { criteria: { minimum: { quality: "2160p" } }, expected: false },
      { criteria: { maximum: { quality: "1080p" } }, expected: true },
      { criteria: { maximum: { quality: "720p" } }, expected: false },
      {
        criteria: {
          minimum: { quality: "1080p" },
          maximum: { quality: "1080p" },
        },
        expected: true,
      },
      {
        criteria: {
          minimum: { quality: "720p" },
          maximum: { quality: "720p" },
        },
        expected: false,
      },
    ];
    for (const { criteria, expected } of examples) {
      expect(
        satisfiesQuality(criteria, item),
        JSON.stringify(criteria)
      ).toEqual(expected);
    }
  });
});
