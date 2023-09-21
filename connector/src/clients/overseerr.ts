import z from "zod";
import log from "../log";
import { secureHash } from "../util/hash";

export type OverseerrRequest = OverseerrRequestTV | OverseerrRequestMovie;
export type OverseerrRequestTV = {
  type: "tv";
  title: string;
  id: number;
  imdbID: string;
  seasons: {
    season: number;
    episodes: { episode: number; airDate: string }[];
  }[];
};
export type OverseerrRequestMovie = {
  type: "movie";
  title: string;
  id: number;
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
  id: z.number(),
  media: z.object({
    mediaType: z.enum(["movie", "tv"]),
    tmdbId: z.number(),
  }),
  seasons: z.array(z.object({ seasonNumber: z.number() })),
});
type RawRequest = z.infer<typeof RAW_REQUEST_SCHEMA>;

export class OverseerrClient {
  lastSeenRequestsHash: string | null = null;

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
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    return resp.data.results;
  }

  /** Update the last seen requests with the most recent results,
   * returning true if they've changed. */
  private newRequests(requests: RawRequest[]): boolean {
    const flattened = requests.map((r) => ({
      id: r.id,
      seasons: r.seasons.map((s) => s.seasonNumber),
    }));
    const currentRequestsHash = secureHash(flattened);
    const changed = currentRequestsHash !== this.lastSeenRequestsHash;
    this.lastSeenRequestsHash = currentRequestsHash;
    return changed;
  }

  async getSeason(tmdbID: number, season: number) {
    const url = `/tv/${tmdbID}/season/${season}`;
    const resp = await this.get(
      url,
      z.object({
        episodes: z.array(
          z.object({
            episodeNumber: z.number(),
            airDate: z.string(),
          })
        ),
      })
    );
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    return resp.data.episodes;
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
      })
    );
    if (!resp.success) throw new ValidationError(url, resp.error, resp.rawData);
    return resp.data;
  }

  /** Fetch metadata for all approved Overseerr requests.
   * If there are no new requests since last time, return null. */
  async getMetadataForApprovedRequests(options: {
    ignoreCache: boolean;
  }): Promise<OverseerrRequest[] | null> {
    const requests = await this.getApprovedRequests();
    if (options.ignoreCache) return this.getMetadata(requests);
    if (!this.newRequests(requests)) {
      log.debug("no new Overseerr requests since last check");
      return null;
    }
    return this.getMetadata(requests);
  }

  /** Get the full media metadata for a set of Overseerr requests. */
  async getMetadata(requests: RawRequest[]): Promise<OverseerrRequest[]> {
    const inFlight = requests.map(async (request) => {
      const { mediaType, tmdbId } = request.media;
      if (mediaType === "movie") {
        const metadata = await this.getMetadataMovie(tmdbId);
        const ret: OverseerrRequestMovie = {
          type: "movie",
          title: metadata.title,
          id: request.id,
          imdbID: metadata.externalIds.imdbId,
          releaseDate: metadata.releaseDate,
        };
        return ret;
      }

      const metadata = await this.getMetadataTV(tmdbId);
      const seasons = await Promise.all(
        request.seasons.map(async ({ seasonNumber }) => ({
          seasonNumber,
          data: await this.getSeason(tmdbId, seasonNumber),
        }))
      );
      const ret: OverseerrRequestTV = {
        type: "tv",
        title: metadata.name,
        id: request.id,
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
