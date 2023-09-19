import { PrismaClient } from "@prisma/client";
import execa from "execa";
import ms from "ms";
import pLimit from "p-limit";
import { OverseerrClient } from "./clients/overseerr";
import { getConfig, getProfiles, initAll } from "./util/config";
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

async function main() {
  initAll();
  const config = getConfig();
  const profiles = getProfiles();

  const overseerrClient = new OverseerrClient({
    host: config.OVERSEERR_HOST,
    apiKey: config.OVERSEERR_API_KEY,
  });

  const { all: migrateOutput } = await execa(
    "pnpm",
    ["prisma", "migrate", "deploy"],
    {
      all: true,
      env: { DATABASE_URL: config.DATABASE_URL },
    }
  );
  log.info({ output: migrateOutput }, "Prisma migration complete");

  const debridCreds: DebridCreds = {
    allDebridAPIKey: config.ALLDEBRID_API_KEY,
  };
  const debridCredsHash = secureHash(debridCreds);

  const prismaClient = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  await prismaClient.$connect();
  const db = new DbClient(prismaClient);

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
    await prismaClient.$disconnect();
  }
}

main();
