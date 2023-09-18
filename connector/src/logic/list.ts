import ms from "ms";
import { pick } from "remeda";
import pLimit from "p-limit";
import {
  OverseerrClient,
  OverseerrRequest,
  OverseerrRequestMovie,
  OverseerrRequestTV,
} from "../clients/overseerr";
import log from "../log";

/** How long before the official release date should we search for content? */
const SEARCH_BEFORE_RELEASE_DATE = ms("7d");
/** How many jobs for outstanding Overseerr requests should we handle at once? */
const OVERSEERR_REQUEST_CONCURRENCY = 5;

export type ToFetch = MovieToFetch | SeasonToFetch | EpisodeToFetch;
type BaseToFetch = {
  imdbID: string;
  title: string;
};
export type MovieToFetch = BaseToFetch & {
  type: "movie";
};
export type SeasonToFetch = BaseToFetch & {
  type: "tv";
  season: number;
};
export type EpisodeToFetch = BaseToFetch & {
  type: "tv";
  season: number;
  episode: number;
};

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
  now: Date
): MovieToFetch | null {
  const mlog = log.child({
    ...pick(request, ["title", "imdbID"]),
    releaseDate: request.releaseDate,
  });
  if (now > startSearchingAt(request)) {
    const relTimeDesc =
      now > new Date(request.releaseDate) ? "released" : "about to be released";
    mlog.debug(`requesting movie which is ${relTimeDesc}`);
    return { type: "movie", title: request.title, imdbID: request.imdbID };
  }
  mlog.debug("not close enough to movie release date, skipping");
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
  now: Date
): (SeasonToFetch | EpisodeToFetch)[] {
  const toFetch: (SeasonToFetch | EpisodeToFetch)[] = [];
  const clog = log.child({ ...pick(request, ["title", "imdbID"]) });

  for (const season of request.seasons) {
    const seasonToFetch: SeasonToFetch = {
      type: "tv",
      title: request.title,
      imdbID: request.imdbID,
      season: season.season,
    };
    const slog = clog.child({ season: season.season });

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
      const elog = slog.child({ episode: episode.episode });

      // Start searching for episodes a few days before the release date.
      const ealog = elog.child({ airDate: episode.airDate });
      if (now > startSearchingAt(episode)) {
        const relTimeDesc =
          now > new Date(episode.airDate) ? "released" : "about to be released";
        ealog.debug(`requesting episode which is ${relTimeDesc}`);
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
  now = new Date()
): ToFetch[] {
  if (request.type === "movie") {
    const toFetch = listOverdueMovie(request, now);
    return toFetch ? [toFetch] : [];
  }
  return listOverdueTV(request, now);
}

/**
 * List the media that should be fetched for approved Radarr requests.
 * @param a.overseerrClient The Overseerr client to use
 * @param a.ignoreCache Whether to ignore the Overseerr new requests cache
 * @returns A list of media to fetch
 */
export async function listOutstanding(a: {
  overseerrClient: OverseerrClient;
  ignoreCache: boolean;
}): Promise<ToFetch[] | "NO_NEW_OVERSEERR_REQUESTS"> {
  const { overseerrClient } = a;
  const ignoreCache = a.ignoreCache ?? false;

  const requests = await overseerrClient.getMetadataForApprovedRequests({
    ignoreCache,
  });
  if (!requests) {
    return "NO_NEW_OVERSEERR_REQUESTS";
  }

  log.debug(
    { requests: requests.map((r) => pick(r, ["imdbID", "title", "type"])) },
    "building list of media to fetch"
  );
  const pool = pLimit(OVERSEERR_REQUEST_CONCURRENCY);
  const jobs = requests.map((r) => pool(async () => listOverdue(r)));
  const results = (await Promise.all(jobs)).flat();

  log.info(
    {
      results: results.map((r) => ({
        type: r.type,
        imdbID: r.imdbID,
        title: r.title,
        season: "season" in r ? r.season : undefined,
        episode: "episode" in r ? r.episode : undefined,
      })),
    },
    "built list of media to fetch"
  );
  return results.flat();
}
