import pLimit from "p-limit";
import { isTruthy } from "remeda";
import { PrismaClient, Snatch } from "@prisma/client";
import log from "../log";

import { OverseerrClient } from "../clients/overseerr";
import { ToFetch, listOutstanding } from "./list";
import { Profile } from "./profile";
import { classifyTorrentioResult, pickBest } from "./classify";
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
    const fslog = flog.child({
      snatch: f.snatch.id,
      lastSnatchedAt: f.snatch.lastSnatchedAt,
    });
    // TODO: test
    // TODO: how do we do this for each profile?
    const snatchURL = f.snatch.refreshURL;
    for (const profile of profiles) {
      if (secureHash(profile) === f.snatch.profileHash) {
        fslog.debug("found existing snatch for profile, refreshing");
        return [
          {
            profile,
            snatchable: { snatchURL },
            origFetch: f,
          },
        ];
      }
    }
    fslog.debug(
      { profiles },
      "existing snatch did not match any profile, finding best candidate"
    );
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
  const { profile, snatchable, origFetch } = i;
  const profileHash = secureHash(profile);

  await snatchViaURL(snatchable);
  const pastSnatch = await db.snatch.findFirst({
    where: {
      imdbID: origFetch.imdbID,
      season: "season" in origFetch ? origFetch.season : null,
      episode: "episode" in origFetch ? origFetch.episode : null,
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
        mediaType: origFetch.type,
        imdbID: origFetch.imdbID,
        refreshURL: snatchable.snatchURL,
        title: origFetch.title,
        season: "season" in origFetch ? origFetch.season : null,
        episode: "episode" in origFetch ? origFetch.episode : null,
        profileHash,
        debridCredsHash,
      },
    });
  }
  log.info({ action, record }, "snatched media and logged to db");
}

/**
 * Fetch all outstanding media for approved Overseerr requests.
 * @param a.dbClient The database client to use
 * @param a.overseerrClient The Overseerr client to query for new requests
 * @param a.debridCreds The Debrid credentials to use when building fetch URLs
 * @param a.profiles The media profiles to evaluate when searching for media
 * @param a.ignoreCache Whether to ignore the Overseerr new requests cache
 */
export async function fetchOutstanding(a: {
  dbClient: PrismaClient;
  overseerrClient: OverseerrClient;
  debridCreds: DebridCreds;
  profiles: Profile[];
  ignoreCache: boolean;
}) {
  const { dbClient, debridCreds, profiles, ignoreCache } = a;

  log.info({ ignoreCache }, "fetching Overseerr requests");
  const toFetch = await listOutstanding(a);
  if (toFetch === "NO_NEW_OVERSEERR_REQUESTS") {
    log.info("no new Overseerr requests, nothing to do");
    return;
  }

  const pool = pLimit(TORRENTIO_REQUEST_CONCURRENCY);
  const searches = toFetch.map((f) =>
    pool(async () => findBestCandidate(debridCreds, profiles, f))
  );
  const searchResults = (await Promise.all(searches)).filter(isTruthy).flat();
  log.info(
    { results: searchResults },
    "discovered torrents that are available for snatch"
  );

  const debridCredsHash = secureHash(debridCreds);
  const snatches = searchResults.map((snatchInfo) =>
    pool(async () => snatchAndLog({ dbClient, snatchInfo, debridCredsHash }))
  );
  await Promise.all(snatches);

  const snatched = searchResults.map((r) => r.origFetch);
  log.info({ snatched }, "all snatches complete");
}
