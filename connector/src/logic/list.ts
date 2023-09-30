import { pick } from "remeda";
import pLimit from "p-limit";
import {
  OverseerrClient,
  OverseerrRequest,
  OverseerrRequestMovie,
  OverseerrRequestTV,
} from "../clients/overseerr";
import log from "../log";
import { ContainedMediaType } from "./rank";

export type ToFetch = MovieToFetch | SeasonToFetch | EpisodeToFetch;
type BaseToFetch = {
  imdbID: string;
  title: string;
  type: ContainedMediaType;
};
export type MovieToFetch = BaseToFetch & {
  type: "movie";
};
export type SeasonToFetch = BaseToFetch & {
  type: "season";
  season: number;
};
export type EpisodeToFetch = BaseToFetch & {
  type: "episode";
  season: number;
  episode: number;
};

/** Determine the date at which we should start searching for a piece of media. */
export function startSearchingAt(
  searchBeforeReleaseDateMs: number,
  item: { airDate: string } | { releaseDate: string }
): Date {
  const raw = "airDate" in item ? item.airDate : item.releaseDate;
  const releaseDate = new Date(raw);
  return new Date(releaseDate.getTime() - searchBeforeReleaseDateMs);
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
  searchBeforeReleaseDateMs: number,
  now: Date
): MovieToFetch | null {
  const mlog = log.child({
    ...pick(request, ["title", "imdbID"]),
    releaseDate: request.releaseDate,
  });
  if (now > startSearchingAt(searchBeforeReleaseDateMs, request)) {
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
  searchBeforeReleaseDateMs: number,
  now: Date
): (SeasonToFetch | EpisodeToFetch)[] {
  const toFetch: (SeasonToFetch | EpisodeToFetch)[] = [];
  const clog = log.child({ ...pick(request, ["title", "imdbID"]) });

  for (const season of request.seasons) {
    const seasonToFetch: SeasonToFetch = {
      type: "season",
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
        type: "episode",
        episode: episode.episode,
      };
      const elog = slog.child({ episode: episode.episode });

      // Start searching for episodes a few days before the release date.
      const ealog = elog.child({ airDate: episode.airDate });
      if (now > startSearchingAt(searchBeforeReleaseDateMs, episode)) {
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
  searchBeforeReleaseDateMs: number,
  now = new Date()
): ToFetch[] {
  if (request.type === "movie") {
    const toFetch = listOverdueMovie(request, searchBeforeReleaseDateMs, now);
    return toFetch ? [toFetch] : [];
  }
  return listOverdueTV(request, searchBeforeReleaseDateMs, now);
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
  overseerrRequestConcurrency: number;
  searchBeforeReleaseDateMs: number;
}): Promise<ToFetch[] | "NO_NEW_REQUESTS"> {
  const { overseerrClient } = a;
  const ignoreCache = a.ignoreCache ?? false;

  const requests =
    await overseerrClient.getMetadataForRequestsAndWatchlistItems({
      ignoreCache,
    });
  if (!requests) {
    return "NO_NEW_REQUESTS";
  }

  log.debug(
    { requests: requests.map((r) => pick(r, ["imdbID", "title", "type"])) },
    "building list of media to fetch"
  );
  const pool = pLimit(a.overseerrRequestConcurrency);
  const jobs = requests.map((r) =>
    pool(async () => listOverdue(r, a.searchBeforeReleaseDateMs))
  );
  const results = (await Promise.all(jobs)).flat();

  log.debug(
    {
      results: results.map((r) => ({
        type: r.type,
        imdbID: r.imdbID,
        title: r.title,
        season: "season" in r ? r.season : undefined,
        episode: "episode" in r ? r.episode : undefined,
      })),
    },
    "built list of current Overseerr requests"
  );
  return results.flat();
}
