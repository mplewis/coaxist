import { describe, expect, it } from "vitest";
import { classify, findSlidingWindowMatch } from "./classify";

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
        expected: { quality: "2160p", season: 2, tags: ["web", "x265"] },
      },
      {
        raw: "Star Trek Strange New Worlds S02E05 MULTI 1080p WEB x264-HiggsBoson",
        expected: {
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["multiaudio", "web", "x264"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.2160p.Dolby.Vision.Multi.Sub.DDP5.1.DV.x265.MP4-BEN.THE.MEN",
        expected: {
          quality: "2160p",
          season: 2,
          episode: 5,
          tags: ["dv", "hdr", "multisub", "x265"],
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
        expected: { quality: "720p", tags: ["web", "x264"] },
      },
      {
        raw: "Barbie.2023.HC.1080p.WEB-DL.AAC2.0.H.264-APEX[TGx]",
        expected: {
          quality: "1080p",
          tags: ["web", "x264"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.Charades.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
        expected: {
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["web", "x264"],
        },
      },
    ];

    for (const { raw, expected } of examples) {
      expect(classify(raw), raw).toEqual(expected);
    }
  });
});
