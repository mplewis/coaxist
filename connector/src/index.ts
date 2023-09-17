import { PrismaClient } from "@prisma/client";
import { serve } from "./server";
import { OverseerrClient } from "./clients/overseerr";
import { getConfig } from "./util/config";
import { listOutstanding } from "./logic/list";
import log from "./log";

async function main() {
  const config = getConfig();

  const overseerrClient = new OverseerrClient({
    host: config.OVERSEERR_HOST,
    apiKey: config.OVERSEERR_API_KEY,
  });

  const dbClient = new PrismaClient();
  await dbClient.$connect();

  const results = await listOutstanding({ dbClient, overseerrClient });
  log.info({ results }, "listOutstanding");

  try {
    serve();
  } finally {
    await dbClient.$disconnect();
  }
}

main();
