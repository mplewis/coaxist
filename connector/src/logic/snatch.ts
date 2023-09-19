import { Snatch } from "@prisma/client";
import { isTruthy, pick } from "remeda";
import ms from "ms";
import { DbClient } from "../clients/db";
import { Snatchable, snatchViaURL } from "../clients/torrentio";
import log from "../log";
import { secureHash } from "../util/hash";
import { EpisodeToFetch, MovieToFetch, SeasonToFetch, ToFetch } from "./list";
import { Profile } from "./profile";
import { getConfig } from "../util/config";

export type FullSnatchInfo = {
  profile: Profile;
  snatchable: Snatchable;
  origFetch: ToFetch;
};

/** Pick the most recently snatched item from a list of snatches. */
export function latestSnatch(snatches: Snatch[]): Snatch {
  return snatches.reduce(
    (acc, s) =>
      s.lastSnatchedAt.getTime() > acc.lastSnatchedAt.getTime() ? s : acc,
    snatches[0]
  );
}

/** Snatch a torrent and record it in the database. */
export async function snatchAndSave(a: {
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
  const summary = pick(record, [
    "id",
    "title",
    "mediaType",
    "imdbID",
    "season",
    "episode",
  ]);
  log.info({ action, record: summary }, "snatched media and logged to db");
  return record;
}

function snatchToFetch(s: Snatch): ToFetch {
  const type = s.mediaType as "movie" | "tv";
  const base = { type, imdbID: s.imdbID, title: s.title };
  if (s.season && s.episode) {
    return { ...base, season: s.season, episode: s.episode } as EpisodeToFetch;
  }
  if (s.season) {
    return { ...base, season: s.season } as SeasonToFetch;
  }
  return base as MovieToFetch;
}

/** Re-snatch all overdue snatches which match the current profiles and Debrid creds. */
export async function resnatchOverdue(a: {
  db: DbClient;
  profiles: Profile[];
  debridCredsHash: string;
}) {
  const { db, profiles, debridCredsHash } = a;
  const { SNATCH_EXPIRY, REFRESH_WITHIN_EXPIRY } = getConfig();
  log.info("refreshing overdue snatches");

  const profileHashes = profiles.map(secureHash);
  const fetchedBefore = new Date(
    Date.now() - ms(SNATCH_EXPIRY) + ms(REFRESH_WITHIN_EXPIRY)
  );
  const overdue = await db.overdueSnatches({
    profileHashes,
    debridCredsHash,
    fetchedBefore,
  });

  const jobs = overdue.map(async (record) => {
    const profile = profiles.find((p) => secureHash(p) === record.profileHash);
    if (!profile) {
      log.warn({ record }, "overdue snatch no longer relevant, purging record");
      await db.deleteSnatch(record.id);
      return null;
    }

    const snatchInfo = {
      profile,
      snatchable: { snatchURL: record.refreshURL },
      origFetch: snatchToFetch(record),
    };
    return snatchAndSave({
      db,
      snatchInfo,
      debridCredsHash,
    });
  });
  const results = await Promise.all(jobs);
  const refreshed = results.filter(isTruthy);
  const summary = refreshed.map((r) =>
    pick(r, ["id", "title", "mediaType", "imdbID", "season", "episode"])
  );
  log.info({ refreshed: summary }, "refreshed overdue snatches");
}
