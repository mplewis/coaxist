import { stripIndent } from "common-tags";
import { describe, expect, it } from "vitest";

import { Quality, compareQuality } from "../data/quality";
import { TAG_MATCHERS } from "../data/tag";
import { findSlidingWindowMatch } from "../util/search";

import {
  TorrentInfo,
  bestMount,
  classify,
  classifyTorrentioResult,
} from "./classify";
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
      // parse properly when neither torrent nor filename have quality
      {
        name: "[RD+] Torrentio\nWEBRip",
        title: stripIndent`
          Homestead Rescue S08 Complete WEBRip x264-skorpion
          Homestead.Rescue.S08E01.Sweet.Homestead.Alabama.WEBRip.x264-skorpion.mp4
          👤 3 💾 981.8 MB ⚙️ 1337x
        `,
        expected: {
          bytes: 1029491916,
          cached: true,
          mediaType: "season",
          season: 8,
          originalResult: {
            name: "[RD+] Torrentio\nWEBRip",
            title: stripIndent`
              Homestead Rescue S08 Complete WEBRip x264-skorpion
              Homestead.Rescue.S08E01.Sweet.Homestead.Alabama.WEBRip.x264-skorpion.mp4
              👤 3 💾 981.8 MB ⚙️ 1337x
            `,
            url: "some url",
          },
          quality: "1080p",
          seeders: 3,
          tags: ["cached", "h264", "web"],
          tracker: "1337x",
        },
      },
      // parse properly when torrent has quality but filename doesn't
      {
        name: "[AD+] Torrentio\nWEBRip",
        title: stripIndent`
          Mr Robot S01 Complete 4k
          Mr.Robot.S01E01.eps1.0_hellofriend.mov.WEBRip.x264-fs0ci3ty.mp4
          👤 1 💾 1.23 GB ⚙️ 1337x
        `,
        expected: {
          bytes: 1320702443,
          cached: true,
          mediaType: "season",
          season: 1,
          originalResult: {
            name: "[AD+] Torrentio\nWEBRip",
            title: stripIndent`
              Mr Robot S01 Complete 4k
              Mr.Robot.S01E01.eps1.0_hellofriend.mov.WEBRip.x264-fs0ci3ty.mp4
              👤 1 💾 1.23 GB ⚙️ 1337x
            `,
            url: "some url",
          },
          quality: "2160p",
          seeders: 1,
          tags: ["cached", "h264", "web"],
          tracker: "1337x",
        },
      },
      // parse properly when filename has quality but torrent doesn't
      {
        name: "[AD+] Torrentio\nWEBRip",
        title: stripIndent`
          Mr Robot S01 Complete
          Mr.Robot.S01E01.eps1.0_hellofriend.mov.4k.WEBRip.x264-fs0ci3ty.mp4
          👤 1 💾 1.23 GB ⚙️ 1337x
        `,
        expected: {
          bytes: 1320702443,
          cached: true,
          mediaType: "season",
          season: 1,
          originalResult: {
            name: "[AD+] Torrentio\nWEBRip",
            title: stripIndent`
              Mr Robot S01 Complete
              Mr.Robot.S01E01.eps1.0_hellofriend.mov.4k.WEBRip.x264-fs0ci3ty.mp4
              👤 1 💾 1.23 GB ⚙️ 1337x
            `,
            url: "some url",
          },
          quality: "2160p",
          seeders: 1,
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

describe("bestMount", () => {
  it("categorizes files as expected", () => {
    const paths = [
      "Asteroid.City.2023.2160p.4K.WEB.x265.10bit.AAC5.1-[YTS.MX].mkv/Asteroid.City.2023.2160p.4K.WEB.x265.10bit.AAC5.1-[YTS.MX].mkv",
      "Cyberpunk - Edgerunners - S01 - MULTi 1080p WEB DV H.265 -NanDesuKa (NF)/Cyberpunk - Edgerunners - S01E01 - MULTi 1080p WEB DV H.265 -NanDesuKa (NF).mkv",
      "Logans.Run.1976.1080p.BluRay.REMUX.VC-1.TrueHD.5.1-FGT/Logans.Run.1976.1080p.BluRay1.TrueHD.5.1-FGT.mkv",
      "[nyadex] Spy x Family - S01 [01-12] (BD 1080p HEVC FLAC-AAC Multi-Audio)/[nyadex] Spy x Family - 01 (BD 1080p HEVC FLAC-AAC Multi-Audio).mkv",
    ];
    const sorted: Record<string, string[]> = {};
    for (const path of paths) {
      const mount = bestMount(path);
      if (!sorted[mount]) sorted[mount] = [];
      sorted[mount].push(path);
    }
    expect(sorted).toMatchInlineSnapshot(`
      {
        "movie": [
          "Asteroid.City.2023.2160p.4K.WEB.x265.10bit.AAC5.1-[YTS.MX].mkv/Asteroid.City.2023.2160p.4K.WEB.x265.10bit.AAC5.1-[YTS.MX].mkv",
          "Logans.Run.1976.1080p.BluRay.REMUX.VC-1.TrueHD.5.1-FGT/Logans.Run.1976.1080p.BluRay1.TrueHD.5.1-FGT.mkv",
        ],
        "series": [
          "Cyberpunk - Edgerunners - S01 - MULTi 1080p WEB DV H.265 -NanDesuKa (NF)/Cyberpunk - Edgerunners - S01E01 - MULTi 1080p WEB DV H.265 -NanDesuKa (NF).mkv",
          "[nyadex] Spy x Family - S01 [01-12] (BD 1080p HEVC FLAC-AAC Multi-Audio)/[nyadex] Spy x Family - 01 (BD 1080p HEVC FLAC-AAC Multi-Audio).mkv",
        ],
      }
    `);
  });
});
