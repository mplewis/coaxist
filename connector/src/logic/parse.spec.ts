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
          tags: ["dolbyvision", "h265", "hdr", "web"],
          tracker: "Rutracker",
          seeders: 1,
          bytes: 6957847019,
        },
      },
    ];
    for (const { raw, expected } of examples) {
      const actual = parseTorrentInfo(raw, url);
      expect(actual, raw).toEqual(expected);
    }
  });
});
