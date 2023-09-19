import { PrismaClient } from "@prisma/client";
import execa from "execa";
import ms from "ms";
import pLimit from "p-limit";
import { OverseerrClient } from "./clients/overseerr";
import { Config, getConfig, getProfiles, initAll } from "./util/config";
import { fetchOutstanding } from "./logic/fetch";
import { DebridCreds } from "./clients/torrentio";
import log from "./log";
import { DbClient } from "./clients/db";
import { resnatchOverdue } from "./logic/snatch";
import { secureHash } from "./util/hash";

function schedule(desc: string, interval: string, task: () => void) {
  setInterval(() => task(), ms(interval));
  const intervalDesc = ms(ms(interval), { long: true });
  log.info({ task: desc, interval: intervalDesc }, "registered periodic task");
}

async function connectDB(config: Config) {
  const { all: migrateOutput } = await execa(
    "pnpm",
    ["prisma", "migrate", "deploy"],
    {
      all: true,
      env: { DATABASE_URL: config.DATABASE_URL },
    }
  );
  log.info({ output: migrateOutput }, "database migration complete");

  const client = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  await client.$connect();
  const db = new DbClient(client);
  return { client, db };
}

async function main() {
  log.info("starting Coaxist Connector");

  initAll();
  const config = getConfig();
  const profiles = getProfiles();

  const debridCreds: DebridCreds = {
    allDebridAPIKey: config.ALLDEBRID_API_KEY,
  };
  const debridCredsHash = secureHash(debridCreds);

  const overseerrClient = new OverseerrClient({
    host: config.OVERSEERR_HOST,
    apiKey: config.OVERSEERR_API_KEY,
  });

  const { client, db } = await connectDB(config);

  const fetchQueue = pLimit(1);
  function fetch(ignoreCache: boolean) {
    return fetchQueue(() =>
      fetchOutstanding({
        db,
        overseerrClient,
        debridCreds,
        profiles,
        ignoreCache,
      })
    );
  }
  function refresh() {
    return resnatchOverdue({ db, debridCredsHash, profiles });
  }

  try {
    await fetch(true);
    await refresh();

    schedule("Overseerr polling", config.OVERSEERR_POLL_INTERVAL, () =>
      fetch(false)
    );
    schedule("torrent search", config.TORRENT_SEARCH_INTERVAL, () =>
      fetch(true)
    );
    schedule(
      "refresh of stale snatches",
      config.SNATCH_REFRESH_CHECK_INTERVAL,
      () => refresh()
    );
  } finally {
    await client.$disconnect();
  }
}

main();
