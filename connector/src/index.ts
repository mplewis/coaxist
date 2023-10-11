import { readFileSync } from "fs";
import { join } from "path";

import { PrismaClient } from "@prisma/client";
import execa from "execa";
import { Level } from "level";
import ms from "ms";
import pLimit from "p-limit";
import z from "zod";

import { DbClient } from "./clients/db";
import { OverseerrClient } from "./clients/overseerr";
import {
  TorrentioSearchResult,
  torrentioSearchResultSchema,
} from "./clients/torrentio";
import { toDebridCreds } from "./data/debrid";
import log from "./log";
import { fetchOutstanding } from "./logic/fetch";
import { resnatchOverdue } from "./logic/snatch";
import { Cache } from "./store/cache";
import { loadOrInitUberConf } from "./uberconf/uberconf";
import { secureHash } from "./util/hash";

const ENV_CONF_SCHEMA = z.intersection(
  z.object({
    /** Location of the config.yaml which holds the UberConf data */
    UBERCONF_PATH: z.string(),
    /** Directory where Connector will store all of its state */
    STORAGE_DIR: z.string(),
    /** Location of the Overseerr server */
    OVERSEERR_HOST: z.string().default("http://localhost:5055"),
  }),
  z.union([
    z.object({ OVERSEERR_CONFIG_PATH: z.string() }),
    z.object({ OVERSEERR_API_KEY: z.string() }),
  ])
);

function getOverseerrAPIKey(path: string): string {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  return data.main.apiKey;
}

function schedule(desc: string, intervalMs: number, task: () => Promise<void>) {
  setInterval(async () => {
    log.debug({ task: desc }, "running periodic task");
    const start = new Date();
    await task();
    log.debug(
      { task: desc, durationMs: new Date().getTime() - start.getTime() },
      "periodic task complete"
    );
  }, intervalMs);
  const intervalDesc = ms(intervalMs, { long: true });
  log.info({ task: desc, interval: intervalDesc }, "registered periodic task");
}

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

  const envConf = ENV_CONF_SCHEMA.parse(process.env);
  const uberConf = loadOrInitUberConf(envConf.UBERCONF_PATH);
  const overseerrAPIKey = (() => {
    if ("OVERSEERR_API_KEY" in envConf) return envConf.OVERSEERR_API_KEY;
    return getOverseerrAPIKey(envConf.OVERSEERR_CONFIG_PATH);
  })();
  const profiles = uberConf.mediaProfiles;

  const torrentioRequestConcurrency =
    uberConf.connector.torrentio.requestConcurrency;
  const overseerrRequestConcurrency =
    uberConf.connector.overseerr.requestConcurrency;
  const searchBeforeReleaseDateMs = uberConf.connector.search.beforeReleaseDate;
  const snatchExpiryMs = uberConf.connector.snatch.debridExpiry;
  const refreshWithinExpiryMs = uberConf.connector.snatch.refreshWithinExpiry;

  const debridCreds = toDebridCreds(uberConf.debrid);
  const debridCredsHash = secureHash(debridCreds);

  const overseerrClient = new OverseerrClient({
    host: envConf.OVERSEERR_HOST,
    apiKey: overseerrAPIKey,
  });

  const databaseUrl = `file:${envConf.STORAGE_DIR}/db.sqlite`;
  const { client, db } = await connectDB(databaseUrl);

  const cacheDir = join(envConf.STORAGE_DIR, "cache");
  const cacheDB = new Level(cacheDir);
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
