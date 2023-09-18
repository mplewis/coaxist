import pLimit from "p-limit";
import { isTruthy, pick } from "remeda";
import log from "../log";

import { OverseerrClient } from "../clients/overseerr";
import { ToFetch, listOutstanding } from "./list";
import { Profile } from "./profile";
import { classifyTorrentioResult, pickBest } from "./classify";
import { secureHash } from "../util/hash";
import {
  DebridCreds,
  buildDebridFetchURL,
  searchTorrentio,
} from "../clients/torrentio";
import { DbClient } from "../clients/db";
import { FullSnatchInfo, snatchAndSave } from "./snatch";

/** How many jobs for outstanding Torrentio requests should we handle at once? */
const TORRENTIO_REQUEST_CONCURRENCY = 5; // TODO: config

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
  const requested = await listOutstanding(a);
  if (requested === "NO_NEW_OVERSEERR_REQUESTS") {
    log.info("no new Overseerr requests, nothing to do");
    return;
  }

  const profileHashes = profiles.map(secureHash);
  const debridCredsHash = secureHash(debridCreds);
  const existingSnatches = await db.snatchesForConfig({
    profileHashes,
    debridCredsHash,
  });
  const existingSnatchHashes = new Set(
    existingSnatches.map((s) => {
      const bits: (string | number)[] = [s.imdbID];
      if (s.season) bits.push(s.season);
      if (s.episode) bits.push(s.episode);
      return secureHash(bits.join(":"));
    })
  );
  const toFetch = requested.filter((r) => {
    const bits: (string | number)[] = [r.imdbID];
    if ("season" in r) bits.push(r.season);
    if ("episode" in r) bits.push(r.episode);
    const hash = secureHash(bits.join(":"));
    return !existingSnatchHashes.has(hash);
  });
  log.debug(
    { before: requested.length, after: toFetch.length },
    "filtered Overseerr requests by existing snatches"
  );
  log.info({ toFetch }, "fetching media for Overseerr requests");

  const pool = pLimit(TORRENTIO_REQUEST_CONCURRENCY);
  const searches = toFetch.map((f) =>
    pool(async () => findBestCandidate(debridCreds, profiles, f))
  );
  const searchResults = (await Promise.all(searches)).filter(isTruthy).flat();
  log.info(
    { results: searchResults },
    "discovered torrents that are available for snatch"
  );

  const snatches = searchResults.map((snatchInfo) =>
    pool(async () => snatchAndSave({ db, snatchInfo, debridCredsHash }))
  );
  const records = await Promise.all(snatches);

  const snatched = searchResults.map((r, i) => ({
    ...r.origFetch,
    snatchID: records[i].id,
    profile: r.profile.name,
  }));
  log.info({ snatched }, "all snatches complete");
}
