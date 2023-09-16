import { describe, expect, it } from "vitest";
import { Snatch } from "@prisma/client";
import { Given } from "../test/given";
import { OverseerrRequestMovie } from "../clients/overseerr";
import {
  latestSnatch,
  listOverdueMovie,
  resnatchAfter,
  startSearchingAt,
} from "./core";

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

describe("startSearchingAt", () => {
  it("returns the expected date", () => {
    expect(startSearchingAt({ airDate: "2020-01-15" })).toEqual(
      new Date("2020-01-08")
    );
    expect(startSearchingAt({ airDate: "2020-02-03" })).toEqual(
      new Date("2020-01-27")
    );
  });
});

describe("listOverdueMovie", () => {
  const { given, v } = new Given({
    request: {
      imdbID: "tt123",
      releaseDate: "2020-03-15",
    } as OverseerrRequestMovie,
    snatches: [] as Snatch[],
    now: {} as Date,
  });
  const subject = () => listOverdueMovie(v.request, v.snatches, v.now);

  describe("when now is after the release date", () => {
    given("now", () => new Date("2020-03-16"));

    describe("when there are no snatches", () => {
      given("snatches", () => [] as Snatch[]);

      it("requests fetch", () => {
        expect(subject()).toEqual({
          type: "movie",
          imdbID: "tt123",
        });
      });
    });

    describe("when there are recent snatches", () => {
      given(
        "snatches",
        () =>
          [
            {
              imdbID: "tt123",
              lastSnatchedAt: new Date("2020-03-12"),
            },
          ] as Snatch[]
      );

      it("does not request fetch", () => {
        expect(subject()).toBeNull();
      });
    });

    describe("when there are stale snatches", () => {
      given(
        "snatches",
        () =>
          [
            {
              imdbID: "tt123",
              lastSnatchedAt: new Date("2020-02-01"),
            },
          ] as Snatch[]
      );

      it("requests fetch", () => {
        expect(subject()).toEqual({
          type: "movie",
          imdbID: "tt123",
          snatch: {
            imdbID: "tt123",
            lastSnatchedAt: new Date("2020-02-01"),
          },
        });
      });
    });
  });

  describe("when now is before the release date", () => {
    given("now", () => new Date("2020-03-01"));

    describe("when there are no snatches", () => {
      given("snatches", () => [] as Snatch[]);

      it("does not request fetch", () => {
        expect(subject()).toEqual(null);
      });
    });
  });
});
