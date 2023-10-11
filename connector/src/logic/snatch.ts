import { Snatch } from "@prisma/client";
import { isTruthy, pick } from "remeda";

import { DbClient } from "../clients/db";
import { Snatchable, snatchViaURL } from "../clients/torrentio";
import { Profile } from "../data/profile";
import log from "../log";
import { secureHash } from "../util/hash";

import { TorrentInfo } from "./classify";
import { EpisodeToFetch, MovieToFetch, SeasonToFetch, ToFetch } from "./list";

export type FullSnatchInfo = {
  profile: Profile;
  info?: TorrentInfo; // TODO: This is only optional because we still do refreshes. Make this mandatory when we don't refresh snatches.
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

  const data: Record<string, any> = {
    action,
    record: pick(record, [
      "id",
      "title",
      "mediaType",
      "imdbID",
      "season",
      "episode",
    ]),
  };
  const { info } = snatchInfo;
  if (info) data.info = pick(info, ["quality", "tags"]);
  log.info(data, "snatched media and logged to db");

  return record;
}

/** Convert a `Snatch` to a `ToFetch` by standardizing its data. */
function snatchToFetch(s: Snatch): ToFetch {
  const type = s.mediaType as "movie" | "tv";
  const base = { type, imdbID: s.imdbID, title: s.title };
  if (s.season && s.episode) {
    return {
      ...base,
      type: "episode",
      season: s.season,
      episode: s.episode,
    } as EpisodeToFetch;
  }
  if (s.season) {
    return {
      ...base,
      type: "season",
      season: s.season,
    } as SeasonToFetch;
  }
  return base as MovieToFetch;
}

/** Re-snatch all overdue snatches which match the current profiles and Debrid creds. */
export async function resnatchOverdue(a: {
  db: DbClient;
  profiles: Profile[];
  debridCredsHash: string;
  snatchExpiryMs: number;
  refreshWithinExpiryMs: number;
}) {
  const {
    db,
    profiles,
    debridCredsHash,
    snatchExpiryMs,
    refreshWithinExpiryMs,
  } = a;
  log.info("refreshing overdue snatches");

  const profileHashes = profiles.map(secureHash);
  const fetchedBefore = new Date(
    Date.now() - snatchExpiryMs + refreshWithinExpiryMs
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
