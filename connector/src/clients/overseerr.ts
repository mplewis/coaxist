import { isTruthy, map, pipe, sortBy } from "remeda";
import z from "zod";

import log from "../log";
import { secureHash } from "../util/hash";

import { RespFailure, getJSON } from "./http";

export type OverseerrRequest = OverseerrRequestTV | OverseerrRequestMovie;
export type OverseerrRequestTV = {
  type: "tv";
  title: string;
  imdbID: string;
  seasons: {
    season: number;
    episodes: { episode: number; airDate: string }[];
  }[];
};
export type OverseerrRequestMovie = {
  type: "movie";
  title: string;
  imdbID: string;
  releaseDate: string;
};

interface Schema<T> {
  safeParse: (
    input: unknown
  ) => { success: true; data: T } | { success: false; error: z.ZodError };
}

const RAW_REQUEST_SCHEMA = z.object({
  media: z.object({
    mediaType: z.enum(["movie", "tv"]),
    tmdbId: z.number(),
  }),
  seasons: z.array(z.object({ seasonNumber: z.number() })),
});
type RawRequest = z.infer<typeof RAW_REQUEST_SCHEMA>;

const WATCHLIST_ITEM_SCHEMA = z.object({
  title: z.string(),
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number(),
});
export type WatchlistItem = z.infer<typeof WATCHLIST_ITEM_SCHEMA>;

const WATCHLIST_PAGE_SCHEMA = z.object({
  page: z.number(),
  totalPages: z.number(),
  totalResults: z.number(),
  results: z.array(WATCHLIST_ITEM_SCHEMA),
});

export class OverseerrClient {
  lastSeenRequestsHash: string | null = null;

  lastSeenWatchlistItemsHash: string | null = null;

  constructor(private a: { host: string; apiKey: string }) {}

  private async get<T>(path: string, schema: Schema<T>) {
    const url = `${this.a.host}/api/v1${path}`;
    const headers = { "X-Api-Key": this.a.apiKey };
    return getJSON<T>(url, schema, { headers });
  }

  /** List approved Overseerr requests. */
  async getApprovedRequests() /*: Promise<RespData<RawRequest[]>> */ {
    const url = `/request?take=99999999&filter=approved`;
    return this.get(
      url,
      z.object({
        results: z.array(RAW_REQUEST_SCHEMA),
      })
    );
  }

  /** List all items on the Plex watchlist. */
  async getWatchlistItems() {
    const getPage = async (page: number) =>
      this.get(`/discover/watchlist?page=${page}`, WATCHLIST_PAGE_SCHEMA);

    const first = await getPage(1);
    if (!first.success) return first;
    const { totalPages, results } = first.data;

    const inFlight = [];
    for (let i = 2; i <= totalPages; i++) {
      inFlight.push(getPage(i));
    }
    for (const page of await Promise.all(inFlight)) {
      if (!page.success) return page;
      results.push(...page.data.results);
    }
    return { success: true as const, items: results };
  }

  /** Update the last seen requests with the most recent results,
   * returning true if they've changed. */
  private newRequests(requests: RawRequest[]): boolean {
    const items = pipe(
      requests,
      sortBy((r) => `${r.media.mediaType}_${r.media.tmdbId}}`),
      map((r) => ({
        mediaType: r.media.mediaType,
        tmdbId: r.media.tmdbId,
        seasons: r.seasons.map((s) => s.seasonNumber).sort(),
      }))
    );
    const currentRequestsHash = secureHash(items);
    const changed = currentRequestsHash !== this.lastSeenRequestsHash;
    this.lastSeenRequestsHash = currentRequestsHash;
    return changed;
  }

  /** Update the last seen watchlist items with the most recent results,
   * returning true if they've changed. */
  private newWatchlistItems(watchlistItems: WatchlistItem[]): boolean {
    const items = pipe(
      watchlistItems,
      sortBy((i) => `${i.mediaType}_${i.tmdbId}}`),
      map((i) => ({ mediaType: i.mediaType, tmdbId: i.tmdbId }))
    );
    const currentWatchlistItemsHash = secureHash(items);
    const changed =
      currentWatchlistItemsHash !== this.lastSeenWatchlistItemsHash;
    this.lastSeenWatchlistItemsHash = currentWatchlistItemsHash;
    return changed;
  }

  /** Get the metadata for a season of a TV show. */
  async getMetadataSeason(tmdbID: number, season: number) {
    const url = `/tv/${tmdbID}/season/${season}`;
    const resp = await this.get(
      url,
      z.object({
        episodes: z.array(
          z.object({
            episodeNumber: z.number(),
            airDate: z.string().or(z.null()),
          })
        ),
      })
    );
    if (!resp.success) return resp;
    // Some episodes lack air dates - we ignore them
    const maybeMissingAirDate = resp.data.episodes;
    const withAirDates = maybeMissingAirDate
      .map((e) => (e.airDate ? { ...e, airDate: e.airDate } : null))
      .filter(isTruthy);
    return { success: true as const, data: withAirDates };
  }

  /** Get the metadata for a movie. */
  async getMetadataMovie(tmdbID: number) {
    return this.get(
      `/movie/${tmdbID}`,
      z.object({
        title: z.string(),
        releaseDate: z.string(),
        externalIds: z.object({ imdbId: z.string() }),
      })
    );
  }

  async getMetadataTV(tmdbID: number) {
    return this.get(
      `/tv/${tmdbID}`,
      z.object({
        name: z.string(),
        externalIds: z.object({ imdbId: z.string() }),
        seasons: z.array(z.object({ seasonNumber: z.number() })),
      })
    );
  }

  // TODO: remove null
  /** Fetch metadata for all approved Overseerr requests and Plex watchlist items.
   * If there are no new requests since last time, return null. */
  async getMetadataForRequestsAndWatchlistItems(options: {
    ignoreCache: boolean;
  }): Promise<OverseerrRequest[] | RespFailure | null> {
    const requestsReq = await this.getApprovedRequests();
    if (!requestsReq.success) return requestsReq;
    const requests = requestsReq.data.results;
    const watchlistReq = await this.getWatchlistItems();
    if (!watchlistReq.success) return watchlistReq;
    const watchlist = watchlistReq.items;

    const nr = this.newRequests(requests);
    const nwi = this.newWatchlistItems(watchlist);
    const newItems = nr || nwi;

    if (newItems || options.ignoreCache) {
      const r1 = await this.rawToOverseerrRequests(requests);
      if (!r1.success) return r1;
      const r2 = await this.watchlistToOverseerrRequests(watchlist);
      if (!r2.success) return r2;
      return [...r1.requests, ...r2.requests];
    }

    log.debug(
      "no new Overseerr requests or Plex watchlist items since last check"
    );
    return null;
  }

  /** Get the full media metadata for a set of Overseerr requests. */
  private async rawToOverseerrRequests(
    requests: RawRequest[]
  ): Promise<{ success: true; requests: OverseerrRequest[] } | RespFailure> {
    const inFlight = requests.map(async (request) => {
      const { mediaType, tmdbId } = request.media;
      if (mediaType === "movie") {
        const metadata = await this.getMetadataMovie(tmdbId);
        if (!metadata.success) return metadata;
        const r: OverseerrRequestMovie = {
          type: "movie",
          title: metadata.data.title,
          imdbID: metadata.data.externalIds.imdbId,
          releaseDate: metadata.data.releaseDate,
        };
        return { success: true as const, request: r };
      }

      const metadata = await this.getMetadataTV(tmdbId);
      if (!metadata.success) return metadata;

      const maybeSeasons = await Promise.all(
        request.seasons
          .filter((s) => s.seasonNumber > 0) // episodes in some Specials seasons lack air dates
          .map(async ({ seasonNumber }) => ({
            seasonNumber,
            data: await this.getMetadataSeason(tmdbId, seasonNumber),
          }))
      );
      const seasons: {
        seasonNumber: number;
        data: { airDate: string; episodeNumber: number }[];
      }[] = [];
      const errors: RespFailure[] = [];
      for (const s of maybeSeasons) {
        if (s.data.success) {
          seasons.push({ seasonNumber: s.seasonNumber, data: s.data.data });
        } else {
          errors.push(s.data);
        }
      }
      if (errors.length > 0) return errors[0];

      const r: OverseerrRequestTV = {
        type: "tv",
        title: metadata.data.name,
        imdbID: metadata.data.externalIds.imdbId,
        seasons: seasons.map((s) => ({
          season: s.seasonNumber,
          episodes: s.data.map((e) => ({
            episode: e.episodeNumber,
            airDate: e.airDate,
          })),
        })),
      };
      return { success: true as const, request: r };
    });

    const results = await Promise.all(inFlight);
    const successes: OverseerrRequest[] = [];
    for (const r of results) {
      if (!r.success) return r;
      successes.push(r.request);
    }
    return { success: true, requests: successes };
  }

  /** Convert the items on the Plex watchlist to Overseerr requests. */
  private async watchlistToOverseerrRequests(
    items: WatchlistItem[]
  ): Promise<{ success: true; requests: OverseerrRequest[] } | RespFailure> {
    const inFlight = items.map(async (item) => {
      const { mediaType, tmdbId } = item;
      if (mediaType === "movie") {
        const metadata = await this.getMetadataMovie(tmdbId);
        if (!metadata.success) return metadata;
        const r: OverseerrRequestMovie = {
          type: "movie",
          title: metadata.data.title,
          imdbID: metadata.data.externalIds.imdbId,
          releaseDate: metadata.data.releaseDate,
        };
        return { success: true as const, request: r };
      }

      const metadata = await this.getMetadataTV(tmdbId);
      if (!metadata.success) return metadata;

      const maybeSeasons = await Promise.all(
        metadata.data.seasons
          .filter((s) => s.seasonNumber > 0) // episodes in some Specials seasons lack air dates
          .map(async ({ seasonNumber }) => ({
            seasonNumber,
            data: await this.getMetadataSeason(tmdbId, seasonNumber),
          }))
      );
      const seasons: {
        seasonNumber: number;
        data: { airDate: string; episodeNumber: number }[];
      }[] = [];
      const errors: RespFailure[] = [];
      for (const s of maybeSeasons) {
        if (s.data.success) {
          seasons.push({ seasonNumber: s.seasonNumber, data: s.data.data });
        } else {
          errors.push(s.data);
        }
      }
      if (errors.length > 0) return errors[0];

      const r: OverseerrRequestTV = {
        type: "tv",
        title: metadata.data.name,
        imdbID: metadata.data.externalIds.imdbId,
        seasons: seasons.map((s) => ({
          season: s.seasonNumber,
          episodes: s.data.map((e) => ({
            episode: e.episodeNumber,
            airDate: e.airDate,
          })),
        })),
      };
      return { success: true as const, request: r };
    });

    const results = await Promise.all(inFlight);
    const successes: OverseerrRequest[] = [];
    for (const r of results) {
      if (!r.success) return r;
      successes.push(r.request);
    }
    return { success: true, requests: successes };
  }
}
