import { stripIndent } from "common-tags";
import { describe, expect, it } from "vitest";

import { Quality, compareQuality } from "../data/quality";
import { TAG_MATCHERS } from "../data/tag";
import { findSlidingWindowMatch } from "../util/search";

import { TorrentInfo, classify, classifyTorrentioResult } from "./classify";
import { parseFromTokens, tokenize } from "./parse";

describe("compareQuality", () => {
  it("sorts qualities as expected", () => {
    const qualities: Quality[] = ["720p", "1080p", "2160p", "480p"];
    expect(qualities.sort(compareQuality)).toEqual([
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
        expected: {
          quality: "2160p",
          mediaType: "season",
          season: 2,
          tags: ["h265", "web"],
        },
      },
      {
        raw: "Star Trek Strange New Worlds S02E05 MULTI 1080p WEB x264-HiggsBoson",
        expected: {
          quality: "1080p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["h264", "multiaudio", "web"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.2160p.Dolby.Vision.Multi.Sub.DDP5.1.DV.x265.MP4-BEN.THE.MEN",
        expected: {
          quality: "2160p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["dolbyvision", "h265", "hdr", "multisub"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.1080p.WEB-DL.DUAL",
        expected: {
          quality: "1080p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["dualaudio", "web"],
        },
      },
      {
        raw: "Barbie.2023.FRENCH.720p.WEBRip.x264-RZP",
        expected: {
          quality: "720p",
          mediaType: "movie",
          tags: ["h264", "web"],
        },
      },
      {
        raw: "Barbie.2023.HC.1080p.WEB-DL.AAC2.0.H.264-APEX[TGx]",
        expected: {
          quality: "1080p",
          mediaType: "movie",
          tags: ["h264", "hardsub", "web"],
        },
      },
      {
        raw: "Star.Trek.Strange.New.Worlds.S02E05.Charades.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv",
        expected: {
          quality: "1080p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["h264", "web"],
        },
      },
      {
        raw: "Star Trek Strange New World S02e05 [1080p Ita Eng Spa h265]",
        expected: {
          quality: "1080p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["h265"],
        },
      },
      {
        raw: "Some.File.Dubbed.1080p (Ads Included!)",
        expected: {
          quality: "1080p",
          mediaType: "movie",
          tags: ["ads", "dub"],
        },
      },
    ];

    for (const { raw, expected } of examples) {
      expect(classify(raw), raw).toEqual(expected);
    }
  });
});

describe("parseTorrentInfo", () => {
  it("parses torrent info as expected", () => {
    const examples: { name: string; title: string; expected: TorrentInfo }[] = [
      {
        name: "[AD+] Torrentio\n1080p",
        title: stripIndent`
          Star Trek Strange New World S02e05 [1080p Ita Eng Spa h265 10bit SubS] byMe7alh
          👤 27 💾 1021.66 MB ⚙️ ThePirateBay
          🇬🇧 / 🇮🇹 / 🇪🇸
        `,
        expected: {
          quality: "1080p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["cached", "h265", "hdr"],
          tracker: "ThePirateBay",
          seeders: 27,
          bytes: 1071288156,
          cached: true,
          originalResult: {
            name: "[AD+] Torrentio\n1080p",
            title: stripIndent`
              Star Trek Strange New World S02e05 [1080p Ita Eng Spa h265 10bit SubS] byMe7alh
              👤 27 💾 1021.66 MB ⚙️ ThePirateBay
              🇬🇧 / 🇮🇹 / 🇪🇸
            `,
            url: "some url",
          },
        },
      },
      {
        name: "[AD+] Torrentio\n4k",
        title: stripIndent`
          Звездный путь: Странные новые миры / Star Trek: Strange New Worlds / Сезон: 2 / Серии: 1-9 из 10 [2023 HEVC HDR10+ Dolby Vision WEB-DL 2160p 4k] 3x MVO (LostFilm HDrezka Studio TVShows) + Original + Sub (Rus Eng)
          Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.PMTP.WEB-DL.DDP5.1.DV.HDR.H.265.RGzsRutracker.mkv
          👤 1 💾 6.48 GB ⚙️ Rutracker
          🇬🇧 / 🇷🇺
        `,
        expected: {
          quality: "2160p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["cached", "dolbyvision", "h265", "hdr", "hdr10plus", "web"],
          tracker: "Rutracker",
          seeders: 1,
          bytes: 6957847019,
          cached: true,
          originalResult: {
            name: "[AD+] Torrentio\n4k",
            title: stripIndent`
              Звездный путь: Странные новые миры / Star Trek: Strange New Worlds / Сезон: 2 / Серии: 1-9 из 10 [2023 HEVC HDR10+ Dolby Vision WEB-DL 2160p 4k] 3x MVO (LostFilm HDrezka Studio TVShows) + Original + Sub (Rus Eng)
              Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.PMTP.WEB-DL.DDP5.1.DV.HDR.H.265.RGzsRutracker.mkv
              👤 1 💾 6.48 GB ⚙️ Rutracker
              🇬🇧 / 🇷🇺
            `,
            url: "some url",
          },
        },
      },
      {
        name: "[AD download] Torrentio\n4k",
        title: stripIndent`
          Star.Trek.Strange.New.Worlds.S02E05.HDR.2160p.WEB.h265-ETHEL[TGx
          👤 89 💾 5.76 GB ⚙️ ThePirateBay
        `,
        expected: {
          quality: "2160p",
          mediaType: "episode",
          season: 2,
          episode: 5,
          tags: ["h265", "hdr", "web"],
          tracker: "ThePirateBay",
          seeders: 89,
          bytes: 6184752906,
          cached: false,
          originalResult: {
            name: "[AD download] Torrentio\n4k",
            title: stripIndent`
              Star.Trek.Strange.New.Worlds.S02E05.HDR.2160p.WEB.h265-ETHEL[TGx
              👤 89 💾 5.76 GB ⚙️ ThePirateBay
            `,
            url: "some url",
          },
        },
      },
      {
        name: "[AD download] Torrentio\n4k",
        title: stripIndent`
          Star.Trek.Strange.New.Worlds.S02.COMPLETE.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb[TGx]
          Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb.mkv
          👤 68 💾 6.45 GB ⚙️ TorrentGalaxy
        `,
        expected: {
          quality: "2160p",
          mediaType: "season",
          season: 2,
          tags: ["h265", "web"],
          tracker: "TorrentGalaxy",
          seeders: 68,
          bytes: 6925634764,
          cached: false,
          originalResult: {
            name: "[AD download] Torrentio\n4k",
            title: stripIndent`
              Star.Trek.Strange.New.Worlds.S02.COMPLETE.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb[TGx]
              Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb.mkv
              👤 68 💾 6.45 GB ⚙️ TorrentGalaxy
            `,
            url: "some url",
          },
        },
      },
      {
        name: "[RD+] Torrentio\nWEBRip",
        title:
          "Homestead Rescue S08 Complete WEBRip x264-skorpion\nHomestead.Rescue.S08E01.Sweet.Homestead.Alabama.WEBRip.x264-skorpion.mp4\n👤 3 💾 981.8 MB ⚙️ 1337x",
        expected: {
          bytes: 1029491916,
          cached: true,
          mediaType: "season",
          season: 8,
          originalResult: {
            name: "[RD+] Torrentio\nWEBRip",
            title:
              "Homestead Rescue S08 Complete WEBRip x264-skorpion\nHomestead.Rescue.S08E01.Sweet.Homestead.Alabama.WEBRip.x264-skorpion.mp4\n👤 3 💾 981.8 MB ⚙️ 1337x",
            url: "some url",
          },
          quality: "1080p",
          seeders: 3,
          tags: ["cached", "h264", "web"],
          tracker: "1337x",
        },
      },
    ];
    for (const { name, title, expected } of examples) {
      const actual = classifyTorrentioResult({ name, title, url: "some url" });
      expect(actual, title).toEqual(expected);
    }
  });
});
