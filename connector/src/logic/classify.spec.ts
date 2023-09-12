import { describe, expect, it } from "vitest";
import {
  Quality,
  TAG_MATCHERS,
  classify,
  findSlidingWindowMatch,
  parseFromTokens,
  sortQuality,
  tokenize,
} from "./classify";

describe("sortQuality", () => {
  it("sorts qualities as expected", () => {
    const qualities: Quality[] = ["720p", "1080p", "2160p", "480p"];
    expect(qualities.sort(sortQuality)).toEqual([
      "2160p",
      "1080p",
      "720p",
      "480p",
    ]);
  });
});

describe("parseFromTokens", () => {
  it("works with certain symbols", async () => {
    const tagMatchersByName = TAG_MATCHERS.reduce(
      (acc, m) => ({ ...acc, [m.name]: m }),
      {} as Record<string, (typeof TAG_MATCHERS)[number]>
    );
    const matchers = [tagMatchersByName.hdr10plus];
    const raw = "some.tokens.with.HDR10+.in.them";
    const tokens = tokenize(raw);
    expect(await parseFromTokens(tokens, matchers)).toEqual(["hdr10plus"]);
  });
});

describe("findSlidingWindowMatch", () => {
  it("finds matches as expected", () => {
    const example = "the quick brown fox jumps over the lazy dog".split(" ");
    const examples = [
      { tokens: "quick", expected: { match: true, index: 1 } },
      { tokens: "fox", expected: { match: true, index: 3 } },
      { tokens: "dog", expected: { match: true, index: 8 } },
      { tokens: "cat", expected: { match: false } },
      {
        tokens: ["quick", "brown", "fox"],
        expected: { match: true, index: 1 },
      },
      { tokens: ["lazy", "dog"], expected: { match: true, index: 7 } },
      { tokens: ["spicy", "dog"], expected: { match: false } },
    ];
    for (const { tokens, expected } of examples) {
      const actual = findSlidingWindowMatch(example, tokens);
      expect(actual, `${tokens}`).toEqual(expected);
    }
  });
});

describe("classify", () => {
  it("classifies media as expected", () => {
    const examples = [
      {
        raw: "Star.Trek.Strange.New.Worlds.S02.COMPLETE.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb[TGx]",
        expected: { quality: "2160p", season: 2, tags: ["h265", "web"] },
      },
      {
        raw: "Star Trek Strange New Worlds S02E05 MULTI 1080p WEB x264-HiggsBoson",
        expected: {
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["h264", "multiaudio", "web"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.2160p.Dolby.Vision.Multi.Sub.DDP5.1.DV.x265.MP4-BEN.THE.MEN",
        expected: {
          quality: "2160p",
          season: 2,
          episode: 5,
          tags: ["dolbyvision", "h265", "hdr", "multisub"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.1080p.WEB-DL.DUAL",
        expected: {
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["dualaudio", "web"],
        },
      },
      {
        raw: "Barbie.2023.FRENCH.720p.WEBRip.x264-RZP",
        expected: { quality: "720p", tags: ["h264", "web"] },
      },
      {
        raw: "Barbie.2023.HC.1080p.WEB-DL.AAC2.0.H.264-APEX[TGx]",
        expected: {
          quality: "1080p",
          tags: ["h264", "hardsub", "web"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.Charades.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
        expected: {
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["h264", "web"],
        },
      },
      {
        raw: "Star Trek Strange New World S02e05 [1080p Ita Eng Spa h265]",
        expected: {
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["h265"],
        },
      },
      {
        raw: "this is not a valid name",
        expected: null,
      },
    ];

    for (const { raw, expected } of examples) {
      expect(classify(raw), raw).toEqual(expected);
    }
  });
});
