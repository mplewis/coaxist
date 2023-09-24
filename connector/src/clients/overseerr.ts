import z from "zod";
import { isTruthy, map, pipe, sortBy } from "remeda";
import log from "../log";
import { secureHash } from "../util/hash";

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

class ValidationError extends Error {
  constructor(url: string, error: z.ZodError, data: unknown) {
    const bits = [url, error.message, JSON.stringify(data, null, 2)];
    super(`${ValidationError}: ${bits.join("\n\n")}`);
  }
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
type WatchlistPage = z.infer<typeof WATCHLIST_PAGE_SCHEMA>;

export class OverseerrClient {
  lastSeenRequestsHash: string | null = null;

  lastSeenWatchlistItemsHash: string | null = null;

  constructor(private a: { host: string; apiKey: string }) {}

  private async get<T>(path: string, schema: Schema<T>) {
    const url = `${this.a.host}/api/v1${path}`;
    log.debug({ url }, "fetching from Overseerr");
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": this.a.apiKey },
    });
    const data = await res.json();
    const result = schema.safeParse(data);
    if (result.success) return result;
    return { ...result, rawData: data };
  }

  /** List approved Overseerr requests. */
  async getApprovedRequests(): Promise<RawRequest[]> {
    const url = `/request?take=99999999&filter=approved`;
    const resp = await this.get(
      url,
      z.object({
        results: z.array(RAW_REQUEST_SCHEMA),
      })
    );
    // TODO: Better error here when you forget to configure the Overseerr API key
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    return resp.data.results;
  }

  /** List all items on the Plex watchlist. */
  async getWatchlistItems(): Promise<WatchlistItem[]> {
    const getPage = async (page: number): Promise<WatchlistPage> => {
      const url = `/discover/watchlist?page=${page}`;
      const resp = await this.get(url, WATCHLIST_PAGE_SCHEMA);
      if (!resp.success)
        throw new ValidationError(url, resp.error, resp.rawData);
      return resp.data;
    };

    const { totalPages, results } = await getPage(1);
    const inFlight = [];
    for (let i = 2; i <= totalPages; i++) {
      inFlight.push(getPage(i));
    }
    for (const page of await Promise.all(inFlight)) {
      results.push(...page.results);
    }
    return results;
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
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    // Some episodes lack air dates - we ignore them
    const maybeMissingAirDate = resp.data.episodes;
    const withAirDates = maybeMissingAirDate
      .map((e) => (e.airDate ? { ...e, airDate: e.airDate } : null))
      .filter(isTruthy);
    return withAirDates;
  }

  async getMetadataMovie(tmdbID: number) {
    const url = `/movie/${tmdbID}`;
    const resp = await this.get(
      url,
      z.object({
        title: z.string(),
        releaseDate: z.string(),
        externalIds: z.object({ imdbId: z.string() }),
      })
    );
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    return resp.data;
  }

  async getMetadataTV(tmdbID: number) {
    const url = `/tv/${tmdbID}`;
    const resp = await this.get(
      url,
      z.object({
        name: z.string(),
        externalIds: z.object({ imdbId: z.string() }),
        seasons: z.array(z.object({ seasonNumber: z.number() })),
      })
    );
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    return resp.data;
  }

  /** Fetch metadata for all approved Overseerr requests and Plex watchlist items.
   * If there are no new requests since last time, return null. */
  async getMetadataForRequestsAndWatchlistItems(options: {
    ignoreCache: boolean;
  }): Promise<OverseerrRequest[] | null> {
    const requests = await this.getApprovedRequests();
    const watchlist = await this.getWatchlistItems();

    const nr = this.newRequests(requests);
    const nwi = this.newWatchlistItems(watchlist);
    const newItems = nr || nwi;

    if (newItems || options.ignoreCache) {
      return [
        ...(await this.rawToOverseerrRequests(requests)),
        ...(await this.watchlistToOverseerrRequests(watchlist)),
      ];
    }

    log.debug(
      "no new Overseerr requests or Plex watchlist items since last check"
    );
    return null;
  }

  /** Get the full media metadata for a set of Overseerr requests. */
  private async rawToOverseerrRequests(
    requests: RawRequest[]
  ): Promise<OverseerrRequest[]> {
    const inFlight = requests.map(async (request) => {
      const { mediaType, tmdbId } = request.media;
      if (mediaType === "movie") {
        const metadata = await this.getMetadataMovie(tmdbId);
        const ret: OverseerrRequestMovie = {
          type: "movie",
          title: metadata.title,
          imdbID: metadata.externalIds.imdbId,
          releaseDate: metadata.releaseDate,
        };
        return ret;
      }

      const metadata = await this.getMetadataTV(tmdbId);
      const seasons = await Promise.all(
        request.seasons
          .filter((s) => s.seasonNumber > 0) // episodes in some Specials seasons lack air dates
          .map(async ({ seasonNumber }) => ({
            seasonNumber,
            data: await this.getMetadataSeason(tmdbId, seasonNumber),
          }))
      );
      const ret: OverseerrRequestTV = {
        type: "tv",
        title: metadata.name,
        imdbID: metadata.externalIds.imdbId,
        seasons: seasons.map((s) => ({
          season: s.seasonNumber,
          episodes: s.data.map((e) => ({
            episode: e.episodeNumber,
            airDate: e.airDate,
          })),
        })),
      };
      return ret;
    });
    return Promise.all(inFlight);
  }

  private async watchlistToOverseerrRequests(
    items: WatchlistItem[]
  ): Promise<OverseerrRequest[]> {
    const inFlight = items.map(async (item) => {
      const { mediaType, tmdbId } = item;
      if (mediaType === "movie") {
        const metadata = await this.getMetadataMovie(tmdbId);
        const ret: OverseerrRequestMovie = {
          type: "movie",
          title: metadata.title,
          imdbID: metadata.externalIds.imdbId,
          releaseDate: metadata.releaseDate,
        };
        return ret;
      }

      const metadata = await this.getMetadataTV(tmdbId);
      const seasons = await Promise.all(
        metadata.seasons
          .filter((s) => s.seasonNumber > 0) // episodes in some Specials seasons lack air dates
          .map(async ({ seasonNumber }) => ({
            seasonNumber,
            data: await this.getMetadataSeason(tmdbId, seasonNumber),
          }))
      );
      const ret: OverseerrRequestTV = {
        type: "tv",
        title: metadata.name,
        imdbID: metadata.externalIds.imdbId,
        seasons: seasons.map((s) => ({
          season: s.seasonNumber,
          episodes: s.data.map((e) => ({
            episode: e.episodeNumber,
            airDate: e.airDate,
          })),
        })),
      };
      return ret;
    });
    return Promise.all(inFlight);
  }
}
