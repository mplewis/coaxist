import { join } from "path";

import { PrismaClient } from "@prisma/client";
import execa from "execa";
import { Level } from "level";
import pLimit from "p-limit";
import z from "zod";

import { DbClient } from "./clients/db";
import { OverseerrClient } from "./clients/overseerr";
import {
  TorrentioSearchResult,
  torrentioSearchResultSchema,
} from "./clients/torrentio";
import { loadConfig } from "./data/config";
import log from "./log";
import { fetchOutstanding } from "./logic/fetch";
import { resnatchOverdue } from "./logic/snatch";
import { Cache } from "./store/cache";
import { schedule } from "./util/schedule";

async function connectDB(dbURL: string) {
  log.info({ url: dbURL }, "connecting to database");
  const { all: migrateOutput } = await execa(
    "pnpm",
    ["prisma", "migrate", "deploy"],
    {
      all: true,
      env: { DATABASE_URL: dbURL },
    }
  );
  log.info({ output: migrateOutput }, "database migration complete");

  const client = new PrismaClient({ datasourceUrl: dbURL });
  await client.$connect();
  const db = new DbClient(client);
  log.info("connected to database");
  return { client, db };
}

async function main() {
  log.info("starting Coaxist Connector");

  const config = loadConfig();
  const { envConf, uberConf, overseerrAPIKey, debridCreds, debridCredsHash } =
    config;

  const profiles = uberConf.mediaProfiles;
  const torrentioRequestConcurrency =
    uberConf.connector.torrentio.requestConcurrency;
  const overseerrRequestConcurrency =
    uberConf.connector.overseerr.requestConcurrency;
  const searchBeforeReleaseDateMs = uberConf.connector.search.beforeReleaseDate;
  const snatchExpiryMs = uberConf.connector.snatch.debridExpiry;
  const refreshWithinExpiryMs = uberConf.connector.snatch.refreshWithinExpiry;

  const cacheDir = join(envConf.STORAGE_DIR, "cache");
  const cacheDB = new Level(cacheDir);

  const overseerrClient = new OverseerrClient({
    cacheDB,
    host: envConf.OVERSEERR_HOST,
    apiKey: overseerrAPIKey,
  });

  const databaseUrl = `file:${envConf.STORAGE_DIR}/db.sqlite`;
  const { client, db } = await connectDB(databaseUrl);

  const torrentioCache = new Cache<TorrentioSearchResult[]>(
    cacheDB,
    "torrentio",
    uberConf.connector.torrentio.cacheExpiry,
    z.array(torrentioSearchResultSchema)
  );

  const fetchQueue = pLimit(1);
  function fetch(ignoreCache: boolean) {
    return fetchQueue(() =>
      fetchOutstanding({
        db,
        overseerrClient,
        debridCreds,
        ignoreCache,
        profiles,
        torrentioCache,
        torrentioRequestConcurrency,
        overseerrRequestConcurrency,
        searchBeforeReleaseDateMs,
      })
    );
  }
  function refresh() {
    return resnatchOverdue({
      db,
      debridCredsHash,
      profiles,
      snatchExpiryMs,
      refreshWithinExpiryMs,
    });
  }

  log.info("startup complete");

  try {
    await fetch(true);
    await refresh();

    schedule(
      "check Overseerr for new requests",
      uberConf.connector.overseerr.pollInterval,
      () => fetch(false)
    );
    schedule(
      "find torrents for all pending requests",
      uberConf.connector.search.outstandingSearchInterval,
      () => fetch(true)
    );
    schedule(
      "refresh stale snatches",
      uberConf.connector.snatch.refreshCheckInterval,
      () => refresh()
    );
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) main();
