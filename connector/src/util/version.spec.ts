import execa from "execa";
import { describe, expect, it } from "vitest";

import { VERSION } from "./version";

describe.skip("version", () => {
  it("matches the latest tag", () => {
    const latestTag = execa.sync("git", [
      "describe",
      "--tags",
      "--abbrev=0",
    ]).stdout;
    expect(`v${VERSION}`).toEqual(latestTag);
  });
});
