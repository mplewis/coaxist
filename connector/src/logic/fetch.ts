import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";
import { isTruthy } from "remeda";
import { OverseerrClient } from "../clients/overseerr";
import { listOutstanding } from "./list";
import {
  DebridCreds,
  buildDebridFetchURL,
  searchTorrentio,
} from "../clients/torrentio";
import log from "../log";
import { Profile } from "./profile";
import { classify, classifyTorrentioResult, pickBest } from "./classify";

/** How many jobs for outstanding Torrentio requests should we handle at once? */
const TORRENTIO_REQUEST_CONCURRENCY = 5;

export async function fetchOutstanding(a: {
  dbClient: PrismaClient;
  overseerrClient: OverseerrClient;
  debridCreds: DebridCreds;
  profiles: Profile[];
}) {
  const toFetch = await listOutstanding(a);

  const pool = pLimit(TORRENTIO_REQUEST_CONCURRENCY);
  const jobs = toFetch.map((f) =>
    pool(async () => {
      const meta =
        "episode" in f
          ? {
              imdbID: f.imdbID,
              season: f.season,
              episode: f.episode,
            }
          : {
              imdbID: f.imdbID,
            };
      const flog = log.child(meta);
      if (f.snatch) {
        // TODO: resnatch
        return;
      }
      const results = await searchTorrentio(meta);
      if (!results) {
        flog.error("torrent search failed");
        return;
      }
      const classified = results.map(classifyTorrentioResult).filter(isTruthy);
      log.debug(
        { count: classified.length },
        "validated torrent search results"
      );
      const bestResults = a.profiles
        .map((p) => {
          const b = pickBest(p, classified);
          return b ? { profile: p.name, best: b } : null;
        })
        .filter(isTruthy);
      const downloadURLs = bestResults.map(({ profile, best }) => ({
        profile,
        url: buildDebridFetchURL(a.debridCreds, best.originalResult),
      }));
      flog.warn({ downloadURLs }, "dry run: will not fetch");
    })
  );
  await Promise.all(jobs);
}
