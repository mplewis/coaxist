import { OverseerrClient } from "../clients/overseerr";

const overseerrClient = new OverseerrClient({
  host: process.env.OVERSEERR_HOST!,
  apiKey: process.env.OVERSEERR_API_KEY!,
});

async function main() {
  const reqs = await overseerrClient.getApprovedRequests();
  console.log(reqs);
  for (const req of reqs) {
    const res = await overseerrClient.getRequest(req.id);
    console.log(res);
  }
}

main();
