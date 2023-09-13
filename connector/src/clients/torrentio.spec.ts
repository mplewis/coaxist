import { describe, expect, it } from "vitest";
import { buildDebridFetchURL } from "./torrentio";

describe("buildDebridFetchURL", () => {
  it("builds the expected URLs", () => {
    const creds = { allDebridAPIKey: "some-api-key" };
    const singleFileResult = {
      title:
        "Star.Trek.Strange.New.Worlds.S02E05.HDR.2160p.WEB.h265-ETHEL[TGx\n👤 77 💾 5.76 GB ⚙️ ThePirateBay",
      infoHash: "16f04d1fac00fdf02210715fbafb38d1dbbe9b04",
      fileIdx: 2,
    };
    expect(
      buildDebridFetchURL(creds, singleFileResult)
    ).toMatchInlineSnapshot('"https://torrentio.strem.fun/alldebrid/some-api-key/16f04d1fac00fdf02210715fbafb38d1dbbe9b04/Star.Trek.Strange.New.Worlds.S02E05.HDR.2160p.WEB.h265-ETHEL%5BTGx/null/Star.Trek.Strange.New.Worlds.S02E05.HDR.2160p.WEB.h265-ETHEL%5BTGx"');
    const multiFileResult = {
      title:
        "Star.Trek.Strange.New.Worlds.S02.COMPLETE.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb[TGx]\nStar.Trek.Strange.New.Worlds.S02E05.Charades.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb.mkv\n👤 52 💾 6.45 GB ⚙️ TorrentGalaxy",
      fileIdx: 5,
      infoHash: "6a0712236b641a74d852039823b218bd5da18fe9",
    };
    expect(buildDebridFetchURL(creds, multiFileResult)).toMatchInlineSnapshot('"https://torrentio.strem.fun/alldebrid/some-api-key/6a0712236b641a74d852039823b218bd5da18fe9/Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb.mkv/5/Star.Trek.Strange.New.Worlds.S02E05.Charades.2160p.AMZN.WEB-DL.DDP5.1.H.265-NTb.mkv"');
  });
});
