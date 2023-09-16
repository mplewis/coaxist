import { describe, expect, it } from "vitest";
import { Snatch } from "@prisma/client";
import { Given } from "../test/given";
import { OverseerrRequestMovie } from "../clients/overseerr";
import { listOverdueMovie } from "./core";

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
