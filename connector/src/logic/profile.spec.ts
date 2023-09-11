import { describe, expect, it } from "vitest";
import { Profile, satisfies, satisfiesQuality, satisfiesTags } from "./profile";
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

describe("satisfiesTags", () => {
  it("returns the expected results", () => {
    const item: Pick<Classification, "tags"> = { tags: ["remux"] };
    const examples: {
      criteria: Pick<Profile, "required" | "forbidden">;
      expected: boolean;
    }[] = [
      { criteria: {}, expected: true },
      { criteria: { required: ["remux"] }, expected: true },
      { criteria: { required: ["web"] }, expected: false },
      { criteria: { forbidden: ["remux"] }, expected: false },
      { criteria: { forbidden: ["web"] }, expected: true },
      { criteria: { required: ["remux"], forbidden: ["web"] }, expected: true },
      {
        criteria: { required: ["web"], forbidden: ["remux"] },
        expected: false,
      },
    ];
    for (const { criteria, expected } of examples) {
      expect(satisfiesTags(criteria, item), JSON.stringify(criteria)).toEqual(
        expected
      );
    }
  });
});

describe("satisfies", () => {
  it("returns the expected results", () => {
    const item: Classification = {
      quality: "1080p",
      tags: ["web", "hdr", "x265"],
    };
    const examples: {
      profile: Profile;
      expected: boolean;
    }[] = [
      {
        profile: {
          name: "My Profile",
          minimum: { quality: "1080p" },
          required: ["x265"],
        },
        expected: true,
      },
      {
        profile: { name: "My Profile", required: ["x265"], forbidden: ["cam"] },
        expected: true,
      },
      {
        profile: {
          name: "My Profile",
          minimum: { quality: "2160p" },
          forbidden: ["hdr"],
        },
        expected: false,
      },
    ];
    for (const { profile, expected } of examples) {
      expect(satisfies(profile, item), JSON.stringify(profile)).toEqual(
        expected
      );
    }
  });
});
