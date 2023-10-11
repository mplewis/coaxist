import { Snatch } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { latestSnatch } from "./snatch";

describe("latestSnatch", () => {
  it("returns the latest snatch", () => {
    const snatches = [
      {
        lastSnatchedAt: new Date("2020-01-01"),
      },
      {
        lastSnatchedAt: new Date("2020-01-03"),
      },
      {
        lastSnatchedAt: new Date("2020-01-02"),
      },
    ] as Snatch[];
    expect(latestSnatch(snatches)).toEqual({
      lastSnatchedAt: new Date("2020-01-03"),
    });
  });
});
