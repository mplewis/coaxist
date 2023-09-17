import pLimit from "p-limit";
import { isTruthy } from "remeda";
import { PrismaClient, Snatch } from "@prisma/client";
import log from "../log";

import { OverseerrClient } from "../clients/overseerr";
import { ToFetch, listOutstanding } from "./list";
import { Profile } from "./profile";
import { TorrentInfo, classifyTorrentioResult, pickBest } from "./classify";
import { secureHash } from "../util/hash";
import {
  DebridCreds,
  Snatchable,
  buildDebridFetchURL,
  searchTorrentio,
  snatchViaURL,
} from "../clients/torrentio";

/** How many jobs for outstanding Torrentio requests should we handle at once? */
const TORRENTIO_REQUEST_CONCURRENCY = 5;

type FullSnatchInfo = {
  profile: Profile;
  info: TorrentInfo;
  snatchable: Snatchable;
  origFetch: ToFetch;
};

async function findBestCandidate(
  creds: DebridCreds,
  profiles: Profile[],
  f: ToFetch
): Promise<FullSnatchInfo[] | null> {
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
    .map((profile) => {
      const best = pickBest(profile, classified);
      return best ? { profile, best } : null;
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
      return { profile, info: best, snatchable: { snatchURL }, origFetch: f };
    })
    .filter(isTruthy);
}

async function snatchAndLog(a: {
  dbClient: PrismaClient;
  snatchInfo: FullSnatchInfo;
  debridCredsHash: string;
}) {
  const { dbClient: db, snatchInfo: i, debridCredsHash } = a;
  const profileHash = secureHash(i.profile);

  await snatchViaURL(i.snatchable);
  const pastSnatch = await db.snatch.findFirst({
    where: {
      imdbID: i.origFetch.imdbID,
      season: "season" in i.origFetch ? i.origFetch.season : null,
      episode: "episode" in i.origFetch ? i.origFetch.episode : null,
      profileHash,
      debridCredsHash,
    },
  });

  let action: string;
  let record: Snatch;
  if (pastSnatch) {
    action = "update";
    pastSnatch.lastSnatchedAt = new Date();
    record = await db.snatch.update({
      where: { id: pastSnatch.id },
      data: pastSnatch,
    });
  } else {
    action = "create";
    record = await db.snatch.create({
      data: {
        mediaType: i.origFetch.type,
        imdbID: i.origFetch.imdbID,
        refreshURL: i.snatchable.snatchURL,
        title: i.origFetch.title,
        season: "season" in i.origFetch ? i.origFetch.season : null,
        episode: "episode" in i.origFetch ? i.origFetch.episode : null,
        profileHash,
        debridCredsHash,
      },
    });
  }
  log.info({ action, record }, "snatched media and logged to db");
}

export async function fetchOutstanding(a: {
  dbClient: PrismaClient;
  overseerrClient: OverseerrClient;
  debridCreds: DebridCreds;
  profiles: Profile[];
}) {
  const toFetch = await listOutstanding(a);

  const pool = pLimit(TORRENTIO_REQUEST_CONCURRENCY);
  const searches = toFetch.map((f) =>
    pool(async () => findBestCandidate(a.debridCreds, a.profiles, f))
  );
  const searchResults = (await Promise.all(searches)).filter(isTruthy).flat();
  log.info(
    { results: searchResults },
    "determined what media needs to be fetched"
  );

  const debridCredsHash = secureHash(a.debridCreds);
  const snatches = searchResults.map((snatchInfo) =>
    pool(async () =>
      snatchAndLog({ dbClient: a.dbClient, snatchInfo, debridCredsHash })
    )
  );
  await Promise.all(snatches);

  const snatched = searchResults.map((r) => r.origFetch);
  log.info({ snatched }, "all snatches complete");
}
