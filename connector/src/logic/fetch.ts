import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";
import { isTruthy } from "remeda";
import { OverseerrClient } from "../clients/overseerr";
import { ToFetch, listOutstanding } from "./list";
import {
  DebridCreds,
  buildDebridFetchURL,
  searchTorrentio,
} from "../clients/torrentio";
import log from "../log";
import { Profile } from "./profile";
import { TorrentInfo, classifyTorrentioResult, pickBest } from "./classify";

/** How many jobs for outstanding Torrentio requests should we handle at once? */
const TORRENTIO_REQUEST_CONCURRENCY = 5;

async function findBestCandidate(
  creds: DebridCreds,
  profiles: Profile[],
  f: ToFetch
): Promise<
  | {
      profile: string;
      info: TorrentInfo;
      snatchURL: string;
    }[]
  | null
> {
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
    return null;
  }

  const results = await searchTorrentio(meta);
  if (!results) {
    flog.error("torrent search failed");
    return null;
  }
  const classified = results.map(classifyTorrentioResult).filter(isTruthy);
  log.debug({ count: classified.length }, "validated torrent search results");

  const bestResults = profiles
    .map((p) => {
      const b = pickBest(p, classified);
      return b ? { profile: p.name, best: b } : null;
    })
    .filter(isTruthy);
  log.debug({ bestResults }, "picked best candidates for each profile");

  return bestResults
    .map(({ profile, best }) => {
      const snatchURL = buildDebridFetchURL(creds, best.originalResult);
      if (!snatchURL) {
        log.warn("could not build snatch URL");
        return null;
      }
      return { profile, info: best, snatchURL };
    })
    .filter(isTruthy);
}

export async function fetchOutstanding(a: {
  dbClient: PrismaClient;
  overseerrClient: OverseerrClient;
  debridCreds: DebridCreds;
  profiles: Profile[];
}) {
  const toFetch = await listOutstanding(a);

  const pool = pLimit(TORRENTIO_REQUEST_CONCURRENCY);
  const jobs = toFetch.map((f) =>
    pool(async () => findBestCandidate(a.debridCreds, a.profiles, f))
  );
  const results = (await Promise.all(jobs)).filter(isTruthy).flat();

  log.info({ results }, "determined what media needs to be fetched");
}
