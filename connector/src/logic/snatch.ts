import ms from "ms";
import { Snatch } from "@prisma/client";
import { DbClient } from "../clients/db";
import { Snatchable, snatchViaURL } from "../clients/torrentio";
import log from "../log";
import { secureHash } from "../util/hash";
import { ToFetch } from "./list";
import { Profile } from "./profile";

export type FullSnatchInfo = {
  profile: Profile;
  snatchable: Snatchable;
  origFetch: ToFetch;
};

/** How long before the Debrid service expires a requested file? */
const SNATCH_EXPIRY = ms("14d");
/** How many days before the file expires should we ask Debrid to refresh it? */
const REFRESH_WITHIN_EXPIRY = ms("2d");

/** Pick the most recently snatched item from a list of snatches. */
export function latestSnatch(snatches: Snatch[]): Snatch {
  return snatches.reduce(
    (acc, s) =>
      s.lastSnatchedAt.getTime() > acc.lastSnatchedAt.getTime() ? s : acc,
    snatches[0]
  );
}

/** Determine the time after which a snatch is considered stale. */
export function resnatchAfter(snatch: Snatch): Date {
  return new Date(
    snatch.lastSnatchedAt.getTime() + SNATCH_EXPIRY - REFRESH_WITHIN_EXPIRY
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
  log.info({ action, record }, "snatched media and logged to db");
}

/** Re-snatch all overdue snatches which match the current profiles and Debrid creds. */
export async function reSnatch(a: {
  db: DbClient;
  profiles: Profile[];
  debridCredsHash: string;
}) {
  const { db, profiles, debridCredsHash } = a;
}
