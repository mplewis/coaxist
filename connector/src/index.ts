import { PrismaClient } from "@prisma/client";
import { log, serve } from "./server";
import { OverseerrClient } from "./clients/overseerr";
import { getConfig } from "./util/config";
import { buildDebridFetchURL, search } from "./clients/torrentio";

async function main() {
  const config = getConfig();

  // const overseerrClient = new OverseerrClient({
  //   host: config.OVERSEERR_HOST,
  //   apiKey: config.OVERSEERR_API_KEY,
  // });

  const dbClient = new PrismaClient();
  await dbClient.$connect();

  try {
    // const resp = await overseerrClient.getMetadataForApprovedRequests();
    // log.info({
    //   requests: resp.map((r) => ({
    //     type: r.request.media.mediaType,
    //     id: r.request.id,
    //     name: r.metadata.name,
    //     tmdbId: r.request.media.tmdbId,
    //     imdbId: r.metadata.externalIds.imdbId,
    //     seasons: r.seasons.map((s) => ({
    //       season: s.seasonNumber,
    //       episodes: s.episodes.map((e) => ({
    //         episode: e.episodeNumber,
    //         airDate: e.airDate,
    //       })),
    //     })),
    //   })),
    // });

    const tvResults = await search({
      imdbID: "tt0804484",
      season: 1,
      episode: 1,
    });
    log.info({ tvResults });

    if (tvResults.ok) {
      tvResults.results.forEach((r) => {
        const fetchURL = buildDebridFetchURL(
          { allDebridAPIKey: config.ALLDEBRID_API_KEY },
          r
        );
        console.log({ title: r.title, fetchURL });
      });
    }

    const movieResults = await search({ imdbID: "tt9198364" });
    log.info({ movieResults });
    if (movieResults.ok) {
      movieResults.results.forEach((r) => {
        const fetchURL = buildDebridFetchURL(
          { allDebridAPIKey: config.ALLDEBRID_API_KEY },
          r
        );
        console.log({ title: r.title, fetchURL });
      });
    }

    serve();
  } finally {
    await dbClient.$disconnect();
  }
}

main();
