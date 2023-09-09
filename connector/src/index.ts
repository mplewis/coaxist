import "dotenv/config";
import { serve } from "./server";
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
  console.log(
    resp.map(
      (r) =>
        `${r.request.id}: ${r.request.media.tmdbId} => ${r.metadata.externalIds.imdbId}`
    )
  );
}

main();
