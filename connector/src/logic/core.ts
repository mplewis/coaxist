import { PrismaClient, Snatch } from "@prisma/client";
import ms from "ms";
import {
  OverseerrClient,
  OverseerrRequest,
  OverseerrRequestMovie,
  OverseerrRequestTV,
} from "../clients/overseerr";

/** How long before the Debrid service expires a requested file? */
const SNATCH_EXPIRY = ms("14d");
/** How many days before the file expires should we ask Debrid to refresh it? */
const REFRESH_WITHIN_EXPIRY = ms("2d");
/** How long before the official release date should we search for content? */
const SEARCH_BEFORE_RELEASE_DATE = ms("7d");

type ToFetch = MovieToFetch | SeasonToFetch | EpisodeToFetch;
type MovieToFetch = {
  snatch?: Snatch;
  type: "movie";
  imdbID: string;
};
type SeasonToFetch = {
  snatch?: Snatch;
  type: "season";
  imdbID: string;
  season: number;
};
type EpisodeToFetch = {
  snatch?: Snatch;
  type: "episode";
  imdbID: string;
  season: number;
  episode: number;
};

export async function fetchOutstanding(a: {
  dbClient: PrismaClient;
  overseerrClient: OverseerrClient;
}) {
  // const requests = await a.overseerrClient.getMetadataForApprovedRequests();
  // const requestsByImdbID = requests.reduce(
  //   (acc, r) => {
  //     acc[r.metadata.externalIds.imdbId] = r;
  //     return acc;
  //   },
  //   {} as Record<string, OverseerrRequest>
  // );
  // const snatches = await a.dbClient.snatch.findMany({
  //   where: { imdbID: { in: Object.keys(requestsByImdbID) } },
  // });
  // const snatchesByImdbID = snatches.reduce(
  //   (acc, s) => {
  //     acc[s.imdbID] = s;
  //     return acc;
  //   },
  //   {} as Record<string, Snatch>
  // );
}

// TODO: test
function latestSnatch(snatches: Snatch[]): Snatch {
  return snatches.reduce(
    (acc, s) =>
      s.lastSnatchedAt.getTime() > acc.lastSnatchedAt.getTime() ? s : acc,
    snatches[0]
  );
}

// TODO: test
function resnatchAfter(snatch: Snatch): Date {
  return new Date(
    snatch.lastSnatchedAt.getTime() + SNATCH_EXPIRY - REFRESH_WITHIN_EXPIRY
  );
}

function startSearchingAt(
  item: { airDate: string } | { releaseDate: string }
): Date {
  const raw = "airDate" in item ? item.airDate : item.releaseDate;
  const releaseDate = new Date(raw);
  return new Date(releaseDate.getTime() - SEARCH_BEFORE_RELEASE_DATE);
}

// TODO: test
function listOverdueMovie(
  request: OverseerrRequestMovie,
  relevantSnatches: Snatch[]
): MovieToFetch | null {
  const now = new Date();
  if (relevantSnatches.length > 0) {
    const latestSnatchForMovie = latestSnatch(relevantSnatches);
    if (now > resnatchAfter(latestSnatchForMovie)) {
      return {
        type: "movie",
        imdbID: request.imdbID,
        snatch: latestSnatchForMovie,
      };
    }
    return null; // if we've snatched this movie, no need to keep searching
  }

  if (now > startSearchingAt(request)) {
    return { type: "movie", imdbID: request.imdbID };
  }

  return null;
}

// TODO: test
function listOverdueTV(
  request: OverseerrRequestTV,
  relevantSnatches: Snatch[]
): (SeasonToFetch | EpisodeToFetch)[] {
  const toFetch: (SeasonToFetch | EpisodeToFetch)[] = [];
  const now = new Date();

  for (const season of request.seasons) {
    // Refresh the latest snatch for this season,
    // if it exists and it's about to expire
    const latestSnatchForSeason = latestSnatch(
      relevantSnatches.filter((s) => s.season === season.season && !s.episode)
    );

    if (latestSnatchForSeason) {
      if (now > resnatchAfter(latestSnatchForSeason)) {
        toFetch.push({
          type: "season",
          imdbID: request.imdbID,
          season: season.season,
          snatch: latestSnatchForSeason,
        });
      }
      continue; // if we've snatched this season, no need to keep searching
    }

    // If all episodes are released, fetch the season.
    // Don't try to fetch the season before the true release date.
    const allEpisodesReleased = season.episodes.every(
      (e) => new Date(e.airDate) <= now
    );
    if (allEpisodesReleased) {
      toFetch.push({
        type: "season",
        imdbID: request.imdbID,
        season: season.season,
      });
      continue;
    }

    // The season has not yet completely aired. Fetch episodes.
    for (const episode of season.episodes) {
      // Refresh the latest snatch for this episode,
      // if it exists and it's about to expire
      const latestSnatchForEpisode = latestSnatch(
        relevantSnatches.filter(
          (s) => s.season === season.season && s.episode === episode.episode
        )
      );

      if (latestSnatchForEpisode) {
        if (now > resnatchAfter(latestSnatchForEpisode)) {
          toFetch.push({
            type: "episode",
            imdbID: request.imdbID,
            season: season.season,
            episode: episode.episode,
            snatch: latestSnatchForEpisode,
          });
        }
        continue; // if we've snatched this episode, no need to keep searching
      }

      if (now > startSearchingAt(episode)) {
        toFetch.push({
          type: "episode",
          imdbID: request.imdbID,
          season: season.season,
          episode: episode.episode,
        });
      }
    }
  }

  return toFetch;
}

// TODO: test
function listOverdue(
  request: OverseerrRequest,
  relevantSnatches: Snatch[]
): ToFetch[] {
  if (request.type === "movie") {
    const toFetch = listOverdueMovie(request, relevantSnatches);
    return toFetch ? [toFetch] : [];
  }
  return listOverdueTV(request, relevantSnatches);
}
