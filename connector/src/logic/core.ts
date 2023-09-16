import { PrismaClient, Snatch } from "@prisma/client";
import ms from "ms";
import {
  OverseerrClient,
  OverseerrRequest,
  OverseerrRequestMovie,
  OverseerrRequestTV,
} from "../clients/overseerr";
import log from "../log";

/** How long before the Debrid service expires a requested file? */
const SNATCH_EXPIRY = ms("14d");
/** How many days before the file expires should we ask Debrid to refresh it? */
const REFRESH_WITHIN_EXPIRY = ms("2d");
/** How long before the official release date should we search for content? */
const SEARCH_BEFORE_RELEASE_DATE = ms("7d");
/** How many jobs for outstanding Overseerr requests should we handle at once? */
const OVERSEERR_REQUEST_CONCURRENCY = 5;

type ToFetch = MovieToFetch | SeasonToFetch | EpisodeToFetch;
type MovieToFetch = {
  snatch?: Snatch;
  type: "movie";
  imdbID: string;
};
type SeasonToFetch = {
  snatch?: Snatch;
  type: "tv";
  imdbID: string;
  season: number;
};
type EpisodeToFetch = {
  snatch?: Snatch;
  type: "tv";
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

/** Pick the most recently snatched item from a list of snatches. */
export function latestSnatch(snatches: Snatch[]): Snatch {
  return snatches.reduce(
    (acc, s) =>
      s.lastSnatchedAt.getTime() > acc.lastSnatchedAt.getTime() ? s : acc,
    snatches[0]
  );
}

/** Determine the time after which a snatch is considered stale. */
export function resnatchAfter(snatch: Snatch): Date {
  return new Date(
    snatch.lastSnatchedAt.getTime() + SNATCH_EXPIRY - REFRESH_WITHIN_EXPIRY
  );
}

/** Determine the date at which we should start searching for a piece of media. */
export function startSearchingAt(
  item: { airDate: string } | { releaseDate: string }
): Date {
  const raw = "airDate" in item ? item.airDate : item.releaseDate;
  const releaseDate = new Date(raw);
  return new Date(releaseDate.getTime() - SEARCH_BEFORE_RELEASE_DATE);
}

/**
 * Determine whether a movie request should be fetched right now.
 * @param request The movie request
 * @param snatches The existing snatches for this movie, if any
 * @param now The current time
 * @returns A movie to fetch, or null if we should not fetch this movie right now
 */
export function listOverdueMovie(
  request: OverseerrRequestMovie,
  snatches: Snatch[],
  now: Date
): MovieToFetch | null {
  const mlog = log.child({ request });
  const snatchesForMovie = snatches.filter(
    (s) => s.imdbID === request.imdbID && !s.season && !s.episode
  );
  if (snatchesForMovie.length > 0) {
    const latestSnatchForMovie = latestSnatch(snatches);
    if (now > resnatchAfter(latestSnatchForMovie)) {
      mlog.debug({ snatch: latestSnatchForMovie }, "resnatching stale movie");
      return {
        type: "movie",
        imdbID: request.imdbID,
        snatch: latestSnatchForMovie,
      };
    }
    mlog.debug(
      { snatch: latestSnatchForMovie },
      "movie was snatched recently, skipping"
    );
    return null;
  }

  const mrlog = mlog.child({ releaseDate: request.releaseDate });
  if (now > startSearchingAt(request)) {
    mrlog.debug("requesting movie which is released or about to be released");
    return { type: "movie", imdbID: request.imdbID };
  }
  mrlog.debug("not close enough to movie release date, skipping");
  return null;
}

/**
 * Determine which parts of a TV season should be fetched right now.
 * @param request The TV request
 * @param snatches The existing snatches for this TV request, if any
 * @param now The current time
 * @returns A list of seasons and episodes that should be fetched right now
 */
export function listOverdueTV(
  request: OverseerrRequestTV,
  snatches: Snatch[],
  now: Date
): (SeasonToFetch | EpisodeToFetch)[] {
  const toFetch: (SeasonToFetch | EpisodeToFetch)[] = [];
  const clog = log.child({ request });

  for (const season of request.seasons) {
    const seasonToFetch: SeasonToFetch = {
      type: "tv",
      imdbID: request.imdbID,
      season: season.season,
    };
    const slog = clog.child({ season: seasonToFetch });
    const snatchesForSeason = snatches.filter(
      (s) =>
        s.imdbID === request.imdbID && s.season === season.season && !s.episode
    );
    if (snatchesForSeason.length > 0) {
      const latestSnatchForSeason = latestSnatch(snatchesForSeason);
      if (now > resnatchAfter(latestSnatchForSeason)) {
        clog.debug(
          { snatch: latestSnatchForSeason },
          "resnatching stale season"
        );
        toFetch.push({ ...seasonToFetch, snatch: latestSnatchForSeason });
      } else {
        clog.debug("season was snatched recently, skipping");
      }
      continue;
    }

    // If all episodes are released, fetch the season.
    // Don't try to fetch the season before the true release date.
    const allEpisodesReleased = season.episodes.every(
      (e) => new Date(e.airDate) <= now
    );
    if (allEpisodesReleased) {
      clog.debug("all episodes released, fetching season");
      toFetch.push(seasonToFetch);
      continue;
    }

    // The season has not yet completely aired. Fetch episodes.
    for (const episode of season.episodes) {
      const episodeToFetch: EpisodeToFetch = {
        ...seasonToFetch,
        episode: episode.episode,
      };
      const elog = slog.child({ episode: episodeToFetch });
      const snatchesForEpisode = snatches.filter(
        (s) =>
          s.imdbID === request.imdbID &&
          s.season === season.season &&
          s.episode === episode.episode
      );
      if (snatchesForEpisode.length > 0) {
        const latestSnatchForEpisode = latestSnatch(snatchesForEpisode);
        if (now > resnatchAfter(latestSnatchForEpisode)) {
          elog.debug(
            { snatch: latestSnatchForEpisode },
            "resnatching stale episode"
          );
          toFetch.push({ ...episodeToFetch, snatch: latestSnatchForEpisode });
        } else {
          elog.debug("episode was snatched recently, skipping");
        }
        continue;
      }

      // Start searching for episodes a few days before the release date.
      const ealog = elog.child({ airDate: episode.airDate });
      if (now > startSearchingAt(episode)) {
        ealog.debug(
          "requesting episode which is released or about to be released"
        );
        toFetch.push(episodeToFetch);
      } else {
        ealog.debug("not close enough to episode release date, skipping");
      }
    }
  }

  return toFetch;
}

/**
 * Determine what we should fetch for a request.
 * @param request The request to check
 * @param relevantSnatches The snatches relevant to this request
 * @param now The current time
 * @returns A list of media to fetch right now
 */
export function listOverdue(
  request: OverseerrRequest,
  relevantSnatches: Snatch[],
  now = new Date()
): ToFetch[] {
  if (request.type === "movie") {
    const toFetch = listOverdueMovie(request, relevantSnatches, now);
    return toFetch ? [toFetch] : [];
  }
  return listOverdueTV(request, relevantSnatches, now);
}
