import { log, serve } from "./server";
import { OverseerrClient } from "./clients/overseerr";
import { getConfig } from "./util/config";

async function main() {
  serve();

  const config = getConfig();

  const overseerrClient = new OverseerrClient({
    host: config.OVERSEERR_HOST,
    apiKey: config.OVERSEERR_API_KEY,
  });

  const resp = await overseerrClient.getMetadataForApprovedRequests();
  log.info({
    requests: resp.map((r) => ({
      id: r.request.id,
      tmdbId: r.request.media.tmdbId,
      imdbId: r.metadata.externalIds.imdbId,
    })),
  });
}

main();
