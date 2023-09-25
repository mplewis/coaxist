import { describe, expect, it } from "vitest";
import {
  Candidate,
  satisfies,
  satisfiesQuality,
  satisfiesTags,
  sortCandidates,
} from "./rank";
import { Classification } from "./classify";
import { Profile, ProfileInput } from "../data/profile";

describe("satisfiesQuality", () => {
  it("returns the expected results", () => {
    const item: Pick<Classification, "quality"> = { quality: "1080p" };
    const examples: {
      profile: Pick<Profile, "minimum" | "maximum">;
      expected: boolean;
    }[] = [
      { profile: {}, expected: true },
      { profile: { minimum: { quality: "1080p" } }, expected: true },
      { profile: { minimum: { quality: "2160p" } }, expected: false },
      { profile: { maximum: { quality: "1080p" } }, expected: true },
      { profile: { maximum: { quality: "720p" } }, expected: false },
      {
        profile: {
          minimum: { quality: "1080p" },
          maximum: { quality: "1080p" },
        },
        expected: true,
      },
      {
        profile: {
          minimum: { quality: "720p" },
          maximum: { quality: "720p" },
        },
        expected: false,
      },
    ];
    for (const { profile, expected } of examples) {
      expect(
        satisfiesQuality(profile as Profile, item as Candidate),
        JSON.stringify(profile)
      ).toEqual(expected);
    }
  });
});

describe("satisfiesTags", () => {
  it("returns the expected results", () => {
    const item: Pick<Classification, "tags"> = { tags: ["remux"] };
    const examples: {
      profile: Pick<Profile, "required" | "forbidden">;
      expected: boolean;
    }[] = [
      { profile: {}, expected: true },
      { profile: { required: ["remux"] }, expected: true },
      { profile: { required: ["web"] }, expected: false },
      { profile: { forbidden: ["remux"] }, expected: false },
      { profile: { forbidden: ["web"] }, expected: true },
      { profile: { required: ["remux"], forbidden: ["web"] }, expected: true },
      {
        profile: { required: ["web"], forbidden: ["remux"] },
        expected: false,
      },
    ];
    for (const { profile, expected } of examples) {
      expect(
        satisfiesTags(profile as Profile, item as Candidate),
        JSON.stringify(profile)
      ).toEqual(expected);
    }
  });
});

describe("satisfies", () => {
  it("returns the expected results", () => {
    const item = {
      quality: "1080p",
      tags: ["web", "hdr", "h265"],
    } as Candidate;
    const examples: {
      profile: ProfileInput;
      expected: boolean;
    }[] = [
      {
        profile: {
          name: "My Profile",
          minimum: { quality: "1080p" },
          required: ["h265"],
        },
        expected: true,
      },
      {
        profile: { name: "My Profile", required: ["h265"], forbidden: ["cam"] },
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
      expect(
        satisfies(profile as Profile, item),
        JSON.stringify(profile)
      ).toEqual(expected);
    }
  });
});

describe("sortCandidates", () => {
  it("sorts candidates as expected", () => {
    const type = "movie";
    const profile: Profile = {
      name: "Reasonable Quality",
      sort: "largestFileSize",
      minimum: { quality: "1080p", seeders: 20 },
      required: ["h265"],
      preferred: ["hdr"],
      discouraged: ["dolbyvision"],
      forbidden: ["remux"],
    };
    const candidates: Candidate[] = [
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr", "remux"],
        seeders: 98,
        bytes: 934917,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr"],
        seeders: 57,
        bytes: 691330,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["remux"],
        seeders: 69,
        bytes: 506686,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265"],
        seeders: 7,
        bytes: 855190,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "dolbyvision"],
        seeders: 19,
        bytes: 623444,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["dolbyvision", "remux"],
        seeders: 73,
        bytes: 92823,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265"],
        seeders: 23,
        bytes: 286314,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "hdr", "dolbyvision"],
        seeders: 26,
        bytes: 999999,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["dolbyvision", "remux"],
        seeders: 41,
        bytes: 246606,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265"],
        seeders: 99,
        bytes: 674637,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "hdr", "dolbyvision", "remux"],
        seeders: 31,
        bytes: 281239,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: [],
        seeders: 39,
        bytes: 713720,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "dolbyvision"],
        seeders: 33,
        bytes: 637126,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "remux"],
        seeders: 72,
        bytes: 889795,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["remux"],
        seeders: 28,
        bytes: 552935,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: [],
        seeders: 13,
        bytes: 146873,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["remux"],
        seeders: 61,
        bytes: 274871,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr", "remux"],
        seeders: 2,
        bytes: 812605,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "remux"],
        seeders: 46,
        bytes: 100520,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["dolbyvision"],
        seeders: 2,
        bytes: 353066,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["hdr", "remux"],
        seeders: 22,
        bytes: 509626,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr", "dolbyvision"],
        seeders: 3,
        bytes: 780131,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr", "remux"],
        seeders: 85,
        bytes: 656518,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "dolbyvision", "remux"],
        seeders: 93,
        bytes: 841698,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "dolbyvision", "remux"],
        seeders: 69,
        bytes: 64783,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr", "remux"],
        seeders: 63,
        bytes: 545029,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "remux"],
        seeders: 18,
        bytes: 886407,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "hdr", "dolbyvision"],
        seeders: 91,
        bytes: 970128,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "hdr", "dolbyvision", "remux"],
        seeders: 87,
        bytes: 605132,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "hdr", "dolbyvision", "remux"],
        seeders: 98,
        bytes: 813567,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "dolbyvision"],
        seeders: 85,
        bytes: 58268,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: ["h265", "dolbyvision"],
        seeders: 53,
        bytes: 291190,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: [],
        seeders: 33,
        bytes: 483420,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["hdr", "remux"],
        seeders: 7,
        bytes: 225551,
      },
      {
        mediaType: "movie",
        quality: "1080p",
        tags: [],
        seeders: 14,
        bytes: 862437,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: [],
        seeders: 81,
        bytes: 304802,
      },
      {
        mediaType: "movie",
        quality: "2160p",
        tags: ["h265", "hdr", "dolbyvision", "remux"],
        seeders: 37,
        bytes: 119797,
      },
      {
        mediaType: "movie",
        quality: "720p",
        tags: ["h265", "hdr", "remux"],
        seeders: 11,
        bytes: 570653,
      },
      {
        mediaType: "season",
        quality: "1080p",
        tags: ["hdr"],
        seeders: 20,
        bytes: 771952,
      },
      {
        mediaType: "episode",
        quality: "1080p",
        tags: ["hdr", "remux"],
        seeders: 67,
        bytes: 548308,
      },
    ];
    const results = sortCandidates(type, profile, candidates);
    expect(results.every((r) => r.tags.includes("h265"))).toBe(true);
    expect(results.every((r) => !r.tags.includes("remux"))).toBe(true);
    expect(results.every((r) => r.seeders > 20)).toBe(true);
    expect(results.every((r) => ["1080p", "2160p"].includes(r.quality))).toBe(
      true
    );
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "bytes": 691330,
          "mediaType": "movie",
          "quality": "1080p",
          "seeders": 57,
          "tags": [
            "h265",
            "hdr",
          ],
        },
        {
          "bytes": 674637,
          "mediaType": "movie",
          "quality": "2160p",
          "seeders": 99,
          "tags": [
            "h265",
          ],
        },
        {
          "bytes": 286314,
          "mediaType": "movie",
          "quality": "1080p",
          "seeders": 23,
          "tags": [
            "h265",
          ],
        },
        {
          "bytes": 999999,
          "mediaType": "movie",
          "quality": "2160p",
          "seeders": 26,
          "tags": [
            "h265",
            "hdr",
            "dolbyvision",
          ],
        },
        {
          "bytes": 637126,
          "mediaType": "movie",
          "quality": "2160p",
          "seeders": 33,
          "tags": [
            "h265",
            "dolbyvision",
          ],
        },
        {
          "bytes": 970128,
          "mediaType": "movie",
          "quality": "1080p",
          "seeders": 91,
          "tags": [
            "h265",
            "hdr",
            "dolbyvision",
          ],
        },
        {
          "bytes": 291190,
          "mediaType": "movie",
          "quality": "1080p",
          "seeders": 53,
          "tags": [
            "h265",
            "dolbyvision",
          ],
        },
        {
          "bytes": 58268,
          "mediaType": "movie",
          "quality": "1080p",
          "seeders": 85,
          "tags": [
            "h265",
            "dolbyvision",
          ],
        },
      ]
    `);
  });
});
