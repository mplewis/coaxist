import { describe, expect, it } from "vitest";
import { Snatch } from "@prisma/client";
import { Given } from "../test/given";
import {
  OverseerrRequestMovie,
  OverseerrRequestTV,
} from "../clients/overseerr";
import {
  latestSnatch,
  listOverdueMovie,
  listOverdueTV,
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
              id: 42,
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
              id: 42,
              imdbID: "tt123",
              lastSnatchedAt: new Date("2020-02-01"),
            },
          ] as Snatch[]
      );

      it("requests fetch with last snatch", () => {
        expect(subject()).toEqual({
          type: "movie",
          imdbID: "tt123",
          snatch: {
            id: 42,
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

describe("listOverdueTV", () => {
  const { given, v } = new Given({
    request: {
      imdbID: "tt123",
      seasons: [
        {
          season: 1,
          episodes: [
            { episode: 1, airDate: "2020-01-15" },
            { episode: 2, airDate: "2020-02-15" },
          ],
        },
      ],
    } as OverseerrRequestTV,
    snatches: [] as Snatch[],
    now: {} as Date,
  });
  const subject = () => listOverdueTV(v.request, v.snatches, v.now);

  describe("season", () => {
    given("now", () => new Date("2020-03-15"));

    describe("snatches exist", () => {
      describe("last snatch is recent", () => {
        given("snatches", () => [
          {
            id: 42,
            imdbID: "tt123",
            season: 1,
            lastSnatchedAt: new Date("2020-03-14"),
          },
        ]);

        it("does not request fetch", () => {
          expect(subject()).toEqual([]);
        });
      });

      describe("last snatch is stale", () => {
        given("snatches", () => [
          {
            id: 42,
            imdbID: "tt123",
            season: 1,
            lastSnatchedAt: new Date("2020-02-15"),
          },
        ]);

        it("requests fetch with last snatch", () => {
          expect(subject()).toEqual([
            {
              type: "season",
              imdbID: "tt123",
              season: 1,
              snatch: {
                id: 42,
                imdbID: "tt123",
                season: 1,
                lastSnatchedAt: new Date("2020-02-15"),
              },
            },
          ]);
        });
      });
    });

    describe("snatches do not exist", () => {
      given("snatches", () => []);

      describe("season has aired", () => {
        given("now", () => new Date("2020-02-16"));

        it("requests fetch", () => {
          expect(subject()).toEqual([
            {
              type: "season",
              imdbID: "tt123",
              season: 1,
            },
          ]);
        });
      });
    });
  });

  describe("episode", () => {
    describe("snatches exist", () => {
      given("snatches", () => [
        {
          id: 42,
          imdbID: "tt123",
          season: 1,
          episode: 1,
          lastSnatchedAt: new Date("2020-01-15"),
        },
      ]);

      describe("last snatch is recent", () => {
        given("now", () => new Date("2020-01-16"));

        it("does not request fetch", () => {
          expect(subject()).toEqual([]);
        });
      });

      describe("last snatch is stale", () => {
        given("now", () => new Date("2020-02-05"));

        it.only("requests fetch with last snatch", () => {
          expect(subject()).toEqual([
            {
              type: "episode",
              imdbID: "tt123",
              season: 1,
              episode: 1,
              snatch: {
                id: 42,
                imdbID: "tt123",
                season: 1,
                episode: 1,
                lastSnatchedAt: new Date("2020-01-15"),
              },
            },
          ]);
        });
      });
    });

    describe("snatches do not exist", () => {
      given("snatches", () => []);

      describe("no episodes have aired", () => {
        given("now", () => new Date("2020-01-14"));

        it("does not request fetch", () => {
          expect(subject()).toEqual([]);
        });
      });

      describe("some episodes have aired", () => {
        given("now", () => new Date("2020-01-16"));

        it("requests fetch", () => {
          expect(subject()).toEqual([
            {
              type: "episode",
              imdbID: "tt123",
              season: 1,
              episode: 1,
            },
          ]);
        });
      });

      describe("all episodes may have aired (early)", () => {
        given("now", () => new Date("2020-02-13"));

        it("requests fetch", () => {
          expect(subject()).toEqual([
            {
              type: "episode",
              imdbID: "tt123",
              season: 1,
              episode: 1,
            },
          ]);
        });
      });
    });
  });
});
