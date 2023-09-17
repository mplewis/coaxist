import { PrismaClient } from "@prisma/client";
import execa from "execa";
import { serve } from "./server";
import { OverseerrClient } from "./clients/overseerr";
import { getConfig } from "./util/config";
import { fetchOutstanding } from "./logic/fetch";
import { DebridCreds } from "./clients/torrentio";
import { Profile } from "./logic/profile";
import log from "./log";

const profiles: Profile[] = [
  {
    name: "Best Available",
    discouraged: ["remux"],
  },
  {
    name: "Accessible",
    maximum: { quality: "1080p" },
    forbidden: ["remux", "hdr"],
  },
];

async function main() {
  const config = await getConfig();

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

  const dbClient = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
  await dbClient.$connect();

  const debridCreds: DebridCreds = {
    allDebridAPIKey: config.ALLDEBRID_API_KEY,
  };

  await fetchOutstanding({
    dbClient,
    overseerrClient,
    debridCreds,
    profiles,
  });

  try {
    serve();
  } finally {
    await dbClient.$disconnect();
  }
}

main();
