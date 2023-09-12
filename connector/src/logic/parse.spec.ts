import { stripIndent } from "common-tags";
import { describe, expect, it } from "vitest";
import { parseTorrentInfo } from "./parse";

describe("parseTorrentInfo", () => {
  it("parses torrent info as expected", () => {
    const url = "https://tracker.example.com/some-path";
    const examples = [
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
