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
