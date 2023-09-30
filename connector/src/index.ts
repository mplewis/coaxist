import { PrismaClient } from "@prisma/client";
import execa from "execa";
import ms from "ms";
import pLimit from "p-limit";
import { readFileSync } from "fs";
import z from "zod";
import { fetchOutstanding } from "./logic/fetch";
import log from "./log";
import { DbClient } from "./clients/db";
import { resnatchOverdue } from "./logic/snatch";
import { secureHash } from "./util/hash";
import { OverseerrClient } from "./clients/overseerr";
import { parseUberConf } from "./uberconf/uberconf";
import { toDebridCreds } from "./data/debrid";

const ENV_CONF_SCHEMA = z.intersection(
  z.object({
    /** Location of the config.yaml which holds the UberConf data */
    UBERCONF_PATH: z.string(),
    /** Directory where Connector will store all of its state */
    STORAGE_DIR: z.string(),
    /**  */
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
  const uberConf = parseUberConf(envConf.UBERCONF_PATH);
  const overseerrAPIKey = (() => {
    if ("OVERSEERR_API_KEY" in envConf) return envConf.OVERSEERR_API_KEY;
    return getOverseerrAPIKey(envConf.OVERSEERR_CONFIG_PATH);
  })();
  const profiles = uberConf.mediaProfiles;

  const debridCreds = toDebridCreds(uberConf.debrid);
  const debridCredsHash = secureHash(debridCreds);

  const overseerrClient = new OverseerrClient({
    host: envConf.OVERSEERR_HOST,
    apiKey: overseerrAPIKey,
  });

  const databaseUrl = `sqlite://${envConf.STORAGE_DIR}/db.sqlite`;
  const { client, db } = await connectDB(databaseUrl);

  const fetchQueue = pLimit(1);
  function fetch(ignoreCache: boolean) {
    return fetchQueue(() =>
      fetchOutstanding({
        db,
        overseerrClient,
        debridCreds,
        ignoreCache,
        profiles,
      })
    );
  }
  function refresh() {
    return resnatchOverdue({ db, debridCredsHash, profiles });
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
