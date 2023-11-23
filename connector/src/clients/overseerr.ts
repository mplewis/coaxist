import { Level } from "level";
import ms from "ms";
import { isTruthy, map, pipe, sortBy } from "remeda";
import z, { Schema } from "zod";

import log from "../log";
import { Cache } from "../store/cache";
import { secureHash } from "../util/hash";

import { getJSON } from "./http";
import { CommonError, RespData, RespFailure } from "./http.types";
import {
  MOVIE_METADATA_SCHEMA,
  MovieMetadata,
  OverseerrRequest,
  OverseerrRequestMovie,
  OverseerrRequestTV,
  RAW_REQUEST_SCHEMA,
  RawRequest,
  TVSeasonMetadata,
  TVShowMetadata,
  TV_SEASON_METADATA_SCHEMA,
  TV_SHOW_METADATA_SCHEMA,
  WATCHLIST_PAGE_SCHEMA,
  WatchlistItem,
} from "./overseerr.types";

const METADATA_EXPIRY_MS = ms("6h");

export class OverseerrClient {
  lastSeenRequestsHash: string | null = null;

  lastSeenWatchlistItemsHash: string | null = null;

  cacheMovie: Cache<MovieMetadata>;

  cacheTVShow: Cache<TVShowMetadata>;

  cacheTVSeason: Cache<TVSeasonMetadata>;

  constructor(
    private a: { host: string; apiKey: string; cacheDB: Level<string, string> }
  ) {
    this.cacheMovie = new Cache(
      a.cacheDB,
      "overseerrMetadataMovie",
      METADATA_EXPIRY_MS,
      MOVIE_METADATA_SCHEMA
    );
    this.cacheTVShow = new Cache(
      a.cacheDB,
      "overseerrMetadataTVShow",
      METADATA_EXPIRY_MS,
      TV_SHOW_METADATA_SCHEMA
    );
    this.cacheTVSeason = new Cache(
      a.cacheDB,
      "overseerrMetadataTVSeason",
      METADATA_EXPIRY_MS,
      TV_SEASON_METADATA_SCHEMA
    );
  }

  private async get<T>(desc: string, path: string, schema: Schema<T>) {
    const url = `${this.a.host}/api/v1${path}`;
    const headers = { "X-Api-Key": this.a.apiKey };
    return getJSON<T>(desc, url, schema, { headers });
  }

  /** List approved Overseerr requests. */
  async getApprovedRequests() /*: Promise<RespData<RawRequest[]>> */ {
    const url = `/request?take=99999999&filter=approved`;
    return this.get(
      "approved Overseerr requests",
      url,
      z.object({ results: z.array(RAW_REQUEST_SCHEMA) })
    );
  }

  /** List all items on the Plex watchlist. */
  async getWatchlistItems() {
    const getPage = async (page: number) =>
      this.get(
        "page of Plex watchlist items",
        `/discover/watchlist?page=${page}`,
        WATCHLIST_PAGE_SCHEMA
      );

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

  /** Get the metadata for a movie. */
  async getMetadataMovie(tmdbID: number) {
    return this.cacheMovie.get(`${tmdbID}`, () =>
      this.get("movie metadata", `/movie/${tmdbID}`, MOVIE_METADATA_SCHEMA)
    );
  }

  /** Get the metadata for a TV show. */
  async getMetadataTVShow(tmdbID: number) {
    return this.cacheTVShow.get(`${tmdbID}`, () =>
      this.get("TV show metadata", `/tv/${tmdbID}`, TV_SHOW_METADATA_SCHEMA)
    );
  }

  /** Get the metadata for a season of a TV show. */
  async getMetadataTVSeason(tmdbID: number, season: number) {
    const url = `/tv/${tmdbID}/season/${season}`;
    const resp = await this.cacheTVSeason.get(`${tmdbID}_${season}`, () =>
      this.get("TV season metadata", url, TV_SEASON_METADATA_SCHEMA)
    );
    if (!resp.success) return resp;
    // Some episodes lack air dates - we ignore them
    const maybeMissingAirDate = resp.data.episodes;
    const withAirDates = maybeMissingAirDate
      .map((e) => (e.airDate ? { ...e, airDate: e.airDate } : null))
      .filter(isTruthy);
    return { success: true as const, data: withAirDates };
  }

  /** Fetch metadata for all approved Overseerr requests and Plex watchlist items.
   * If there are no new requests since last time, return null. */
  async getMetadataForRequestsAndWatchlistItems(options: {
    ignoreCache: boolean;
  }): Promise<RespData<OverseerrRequest[]>> {
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
      return { success: true, data: [...r1.data, ...r2.data] };
    }

    return { success: true, data: [] };
  }

  /** Get the full media metadata for a set of Overseerr requests. */
  private async rawToOverseerrRequests(
    requests: RawRequest[]
  ): Promise<RespData<OverseerrRequest[]>> {
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

      const metadata = await this.getMetadataTVShow(tmdbId);
      if (!metadata.success) return metadata;

      const maybeSeasons = await Promise.all(
        request.seasons
          .filter((s) => s.seasonNumber > 0) // episodes in some Specials seasons lack air dates
          .map(async ({ seasonNumber }) => ({
            seasonNumber,
            data: await this.getMetadataTVSeason(tmdbId, seasonNumber),
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
    return { success: true, data: successes };
  }

  /** Convert the items on the Plex watchlist to Overseerr requests. */
  private async watchlistToOverseerrRequests(
    items: WatchlistItem[]
  ): Promise<RespData<OverseerrRequest[]>> {
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

      const metadata = await this.getMetadataTVShow(tmdbId);
      if (!metadata.success) return metadata;

      const maybeSeasons = await Promise.all(
        metadata.data.seasons
          .filter((s) => s.seasonNumber > 0) // episodes in some Specials seasons lack air dates
          .map(async ({ seasonNumber }) => ({
            seasonNumber,
            data: await this.getMetadataTVSeason(tmdbId, seasonNumber),
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
    const data: OverseerrRequest[] = [];
    const errors: CommonError[] = [];

    for (const r of results) {
      if (r.success) {
        data.push(r.request);
        continue;
      }
      for (const e of r.errors) {
        if (e.errorCategory === "validation") {
          log.warn(e, "Error validating Overseerr watchlist item metadata");
        } else {
          errors.push(e);
          log.error(e, "Error fetching Overseerr watchlist item metadata");
        }
      }
    }

    return errors.length === 0
      ? { success: true, data }
      : { success: false, errors };
  }
}
