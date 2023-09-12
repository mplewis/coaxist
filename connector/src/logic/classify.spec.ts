import { describe, expect, it } from "vitest";
import { stripIndent } from "common-tags";
import { TorrentInfo, classify, parseTorrentInfo, pickBest } from "./classify";
import { TAG_MATCHERS, Tag } from "../data/tag";
import { Profile } from "./profile";
import { Quality, sortQuality } from "../data/quality";
import { parseFromTokens, tokenize } from "./parse";
import { findSlidingWindowMatch } from "../util/search";

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

describe("parseTorrentInfo", () => {
  it("parses torrent info as expected", () => {
    const url = "https://tracker.example.com/some-path";
    const examples: { raw: string; expected: TorrentInfo }[] = [
      {
        raw: stripIndent`
          Star Trek Strange New World S02e05 [1080p Ita Eng Spa h265 10bit SubS] byMe7alh
          👤 27 💾 1021.66 MB ⚙️ ThePirateBay
          🇬🇧 / 🇮🇹 / 🇪🇸
        `,
        expected: {
          url,
          quality: "1080p",
          season: 2,
          episode: 5,
          tags: ["h265", "hdr"],
          tracker: "ThePirateBay",
          seeders: 27,
          bytes: 1071288156,
        },
      },
      {
        raw: stripIndent`
          Звездный путь: Странные новые миры / Star Trek: Strange New Worlds / Сезон: 2 / Серии: 1-9 из 10 [2023 HEVC HDR10+ Dolby Vision WEB-DL 2160p 4k] 3x MVO (LostFilm HDrezka Studio TVShows) + Original + Sub (Rus Eng)
          Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.PMTP.WEB-DL.DDP5.1.DV.HDR.H.265.RGzsRutracker.mkv
          👤 1 💾 6.48 GB ⚙️ Rutracker
          🇬🇧 / 🇷🇺
        `,
        expected: {
          url,
          quality: "2160p",
          season: 2,
          episode: 5,
          tags: ["dolbyvision", "h265", "hdr", "hdr10plus", "web"],
          tracker: "Rutracker",
          seeders: 1,
          bytes: 6957847019,
        },
      },
      {
        raw: stripIndent`
          Star.Trek.Strange.New.Worlds.S02E05.HDR.2160p.WEB.h265-ETHEL[TGx
          👤 89 💾 5.76 GB ⚙️ ThePirateBay
        `,
        expected: {
          url,
          quality: "2160p",
          season: 2,
          episode: 5,
          tags: ["h265", "hdr", "web"],
          tracker: "ThePirateBay",
          seeders: 89,
          bytes: 6184752906,
        },
      },
      {
        raw: stripIndent`
          Star.Trek.Strange.New.Worlds.S02.COMPLETE.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb[TGx]
          Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb.mkv
          👤 68 💾 6.45 GB ⚙️ TorrentGalaxy
        `,
        expected: {
          url,
          quality: "2160p",
          season: 2,
          tags: ["h265", "web"],
          tracker: "TorrentGalaxy",
          seeders: 68,
          bytes: 6925634764,
        },
      },
    ];
    for (const { raw, expected } of examples) {
      const actual = parseTorrentInfo(raw, url);
      expect(actual, raw).toEqual(expected);
    }
  });
});

describe("pickBest", () => {
  function cand(seeders: number, quality: Quality, tags: Tag[]): TorrentInfo {
    return {
      seeders,
      quality,
      tags,
      url: "url",
      bytes: 0,
      tracker: "tracker",
    };
  }

  it("picks the best candidate", () => {
    const profile: Profile = {
      name: "Most Compatible",
      maximum: { quality: "1080p" },
      required: ["multiaudio"],
      discouraged: ["hdr"],
      forbidden: ["hdtv"],
    };
    const cands = [
      cand(333, "2160p", []),
      cand(105, "1080p", ["hdr"]),
      cand(105, "1080p", []),
      cand(105, "1080p", ["hdtv", "multiaudio"]),
      cand(100, "1080p", ["multiaudio"]), // pick!
      cand(97, "1080p", []),
      cand(333, "720p", []),
    ];
    expect(pickBest(profile, cands)).toEqual(cands[4]);
  });

  it("downranks candidates that match discouraged criteria", () => {
    const profile: Profile = {
      name: "No HDR",
      discouraged: ["hdr"],
    };
    const cands = [
      cand(100, "2160p", ["hdr"]),
      cand(5, "480p", []), // pick!
    ];
    expect(pickBest(profile, cands)).toEqual(cands[1]);
  });

  it("ignores candidates missing the required criteria", () => {
    const profile: Profile = {
      name: "HDR required",
      required: ["hdr"],
    };
    const cands = [
      cand(100, "2160p", []),
      cand(100, "1080p", []),
      cand(100, "480p", []),
    ];
    expect(pickBest(profile, cands)).toEqual(null);
  });

  it("returns no candidate if none are acceptable", () => {
    const profile: Profile = {
      name: "1080p",
      minimum: { quality: "1080p" },
      maximum: { quality: "1080p" },
      forbidden: ["hdr"],
    };
    const cands = [
      cand(100, "2160p", []),
      cand(100, "1080p", ["hdr"]),
      cand(100, "720p", []),
    ];
    expect(pickBest(profile, cands)).toEqual(null);
  });
});
