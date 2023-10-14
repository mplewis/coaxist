import ms from "ms";
import { describe, expect, it } from "vitest";

import {
  OverseerrRequestMovie,
  OverseerrRequestTV,
} from "../clients/overseerr.types";
import { Given } from "../test/given";

import {
  listOverdue,
  listOverdueMovie,
  listOverdueTV,
  startSearchingAt,
} from "./list";

describe("with mock config", () => {
  const searchBeforeReleaseDateMs = ms("7d");

  describe("startSearchingAt", () => {
    it("returns the expected date", () => {
      expect(
        startSearchingAt(searchBeforeReleaseDateMs, { airDate: "2020-01-15" })
      ).toEqual(new Date("2020-01-08"));
      expect(
        startSearchingAt(searchBeforeReleaseDateMs, { airDate: "2020-02-03" })
      ).toEqual(new Date("2020-01-27"));
    });
  });

  describe("listOverdueMovie", () => {
    const { given, v } = new Given({
      request: {
        imdbID: "tt123",
        releaseDate: "2020-03-15",
      } as OverseerrRequestMovie,
      now: {} as Date,
    });
    const subject = () =>
      listOverdueMovie(v.request, searchBeforeReleaseDateMs, v.now);

    describe("when now is after the release date", () => {
      given("now", () => new Date("2020-03-16"));

      it("requests fetch", () => {
        expect(subject()).toEqual({
          type: "movie",
          imdbID: "tt123",
        });
      });
    });

    describe("when now is before the release date", () => {
      given("now", () => new Date("2020-03-01"));

      it("does not request fetch", () => {
        expect(subject()).toEqual(null);
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
      now: {} as Date,
    });
    const subject = () =>
      listOverdueTV(v.request, searchBeforeReleaseDateMs, v.now);

    describe("season", () => {
      describe("season has not yet aired", () => {
        given("now", () => new Date("2020-01-01"));

        it("does not request fetch", () => {
          expect(subject()).toEqual([]);
        });
      });

      describe("season has aired", () => {
        given("now", () => new Date("2020-03-15"));

        it("requests fetch", () => {
          expect(subject()).toMatchInlineSnapshot(`
          [
            {
              "imdbID": "tt123",
              "season": 1,
              "title": undefined,
              "type": "season",
            },
          ]
        `);
        });
      });
    });

    describe("episode", () => {
      describe("no episodes have aired", () => {
        given("now", () => new Date("2020-01-01"));

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
            {
              type: "episode",
              imdbID: "tt123",
              season: 1,
              episode: 2,
            },
          ]);
        });
      });
    });
  });

  describe("listOverdue", () => {
    describe("movie", () => {
      const request = {
        type: "movie",
        imdbID: "tt123",
        releaseDate: "2020-01-01",
      } as OverseerrRequestMovie;

      it("returns overdue movies", () => {
        const now = new Date("2020-01-02");
        expect(listOverdue(request, searchBeforeReleaseDateMs, now)).toEqual([
          { type: "movie", imdbID: "tt123" },
        ]);
      });
    });

    describe("TV season", () => {
      const request = {
        type: "tv",
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
      } as OverseerrRequestTV;

      describe("almost fully aired", () => {
        const now = new Date("2020-02-14");

        it("returns overdue episodes", () => {
          expect(listOverdue(request, searchBeforeReleaseDateMs, now)).toEqual([
            { type: "episode", imdbID: "tt123", season: 1, episode: 1 },
            { type: "episode", imdbID: "tt123", season: 1, episode: 2 },
          ]);
        });
      });

      describe("fully aired", () => {
        const now = new Date("2020-02-16");

        it("returns overdue season", () => {
          expect(listOverdue(request, searchBeforeReleaseDateMs, now)).toEqual([
            { type: "season", imdbID: "tt123", season: 1 },
          ]);
        });
      });
    });
  });
});
