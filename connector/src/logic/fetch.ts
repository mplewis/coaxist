import pLimit from "p-limit";
import { isTruthy, shuffle } from "remeda";

import { DbClient } from "../clients/db";
import { OverseerrClient } from "../clients/overseerr";
import { TorrentioSearchResult, searchTorrentio } from "../clients/torrentio";
import { DebridCreds } from "../data/debrid";
import { Profile } from "../data/profile";
import log from "../log";
import { Cache } from "../store/cache";
import { secureHash } from "../util/hash";

import { classifyTorrentioResult } from "./classify";
import { ToFetch, listOutstanding } from "./list";
import { pickBest } from "./rank";
import { FullSnatchInfo, snatchAndSave } from "./snatch";

/** Search Torrentio for the best candidate for the given profiles and target media. */
async function findBestCandidate(
  creds: DebridCreds,
  torrentioCache: Cache<TorrentioSearchResult[]>,
  profiles: Profile[],
  f: ToFetch
): Promise<FullSnatchInfo[] | null> {
  const flog = log.child(f);

  const results = await searchTorrentio(creds, torrentioCache, f);
  if (!results) {
    flog.error("torrent search failed");
    return null;
  }
  const classified = results.map(classifyTorrentioResult).filter(isTruthy);
  log.debug({ count: classified.length }, "validated torrent search results");

  const bestResults = profiles
    .map((profile) => {
      const best = pickBest(f.type, profile, classified);
      return best ? { profile, best } : null;
    })
    .filter(isTruthy);
  log.debug({ bestResults }, "picked best candidates for each profile");

  return bestResults.map(({ profile, best }) => ({
    profile,
    info: best,
    snatchable: { snatchURL: best.originalResult.url },
    origFetch: f,
  }));
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
  torrentioCache: Cache<TorrentioSearchResult[]>;
  torrentioRequestConcurrency: number;
  overseerrRequestConcurrency: number;
  searchBeforeReleaseDateMs: number;
  ignoreCache: boolean;
}) {
  const {
    db,
    debridCreds,
    profiles,
    torrentioCache,
    torrentioRequestConcurrency,
    ignoreCache,
  } = a;

  log.debug({ ignoreCache }, "fetching Overseerr requests");
  const resp = await listOutstanding(a);
  if (!resp.success) {
    log.error({ errors: resp.errors }, "failed to fetch Overseerr requests");
    return;
  }
  const requested = resp.data;
  if (requested === "NO_NEW_REQUESTS") {
    log.debug("no new Overseerr requests, nothing to do");
    return;
  }

  // fill requests in different order to avoid ratelimiting poison pills
  const shuffled = shuffle(requested);

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
  const toFetch = shuffled.filter((r) => {
    const bits: (string | number)[] = [r.imdbID];
    if ("season" in r) bits.push(r.season);
    if ("episode" in r) bits.push(r.episode);
    const hash = secureHash(bits.join(":"));
    return !existingSnatchHashes.has(hash);
  });
  log.debug(
    { before: shuffled.length, after: toFetch.length },
    "filtered Overseerr requests by existing snatches"
  );
  log.info({ toFetch }, "fetching requested media");

  const pool = pLimit(torrentioRequestConcurrency);
  const searches = toFetch.map((f) =>
    pool(async () =>
      findBestCandidate(debridCreds, torrentioCache, profiles, f)
    )
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
  log.info({ snatchCount: snatched.length }, "all snatches complete");
}
