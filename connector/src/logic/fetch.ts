import pLimit from "p-limit";
import { isTruthy } from "remeda";
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
import { DbClient } from "../clients/db";

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
  db: DbClient;
  snatchInfo: FullSnatchInfo;
  debridCredsHash: string;
}) {
  const { db, snatchInfo, debridCredsHash } = a;
  const { profile, snatchable, origFetch } = snatchInfo;
  const profileHash = secureHash(profile);

  await snatchViaURL(snatchable);
  const { action, record } = await db.upsertSnatch({
    media: origFetch,
    snatchable,
    profileHash,
    debridCredsHash,
  });
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
  db: DbClient;
  overseerrClient: OverseerrClient;
  debridCreds: DebridCreds;
  profiles: Profile[];
  ignoreCache: boolean;
}) {
  const { db, debridCreds, profiles, ignoreCache } = a;

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
    pool(async () => snatchAndLog({ db, snatchInfo, debridCredsHash }))
  );
  await Promise.all(snatches);

  const snatched = searchResults.map((r) => r.origFetch);
  log.info({ snatched }, "all snatches complete");
}
