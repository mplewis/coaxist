import "dotenv/config";
import { serve } from "./server";
import { OverseerrClient } from "./clients/overseerr";

async function main() {
  serve();

  const overseerrClient = new OverseerrClient({
    host: process.env.OVERSEERR_HOST!,
    apiKey: process.env.OVERSEERR_API_KEY!,
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
