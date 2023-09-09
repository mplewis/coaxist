import "dotenv/config";
import { serve } from "./server";
import { OverseerrClient } from "./clients/overseerr";

async function main() {
  serve();

  const overseerrClient = new OverseerrClient({
    host: process.env.OVERSEERR_HOST!,
    apiKey: process.env.OVERSEERR_API_KEY!,
  });

  const requests = await overseerrClient.getApprovedRequests();
  for (const request of requests) {
    const requestDetails = await overseerrClient.getRequest(request.id);
    console.log(requestDetails.media.tmdbId);
  }
}

main();
