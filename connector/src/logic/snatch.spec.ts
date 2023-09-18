import { describe, expect, it } from "vitest";
import { Snatch } from "@prisma/client";
import { latestSnatch, resnatchAfter } from "./snatch";

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

describe("resnatchAfter", () => {
  it("returns the expected date", () => {
    expect(
      resnatchAfter({
        lastSnatchedAt: new Date("2020-01-01"),
      } as Snatch)
    ).toEqual(new Date("2020-01-13"));
    expect(
      resnatchAfter({
        lastSnatchedAt: new Date("2020-04-19"),
      } as Snatch)
    ).toEqual(new Date("2020-05-01"));
  });
});
