import { PrismaClient } from "@prisma/client";
import execa from "execa";
import ms from "ms";
import pLimit from "p-limit";
import { OverseerrClient } from "./clients/overseerr";
import { getConfig, getProfiles } from "./util/config";
import { fetchOutstanding } from "./logic/fetch";
import { DebridCreds } from "./clients/torrentio";
import log from "./log";
import { DbClient } from "./clients/db";

async function main() {
  const config = await getConfig();
  const profiles = await getProfiles();

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

  try {
    log.info("performing initial search");
    await fetch(true);

    setInterval(() => fetch(false), ms(config.OVERSEERR_POLL_INTERVAL));
    log.info(
      { interval: ms(ms(config.OVERSEERR_POLL_INTERVAL), { long: true }) },
      "registered Overseerr polling"
    );

    setInterval(() => fetch(true), ms(config.TORRENT_SEARCH_INTERVAL));
    log.info(
      { interval: ms(ms(config.TORRENT_SEARCH_INTERVAL), { long: true }) },
      "registered periodic torrent search"
    );
  } finally {
    await prismaClient.$disconnect();
  }
}

main();
