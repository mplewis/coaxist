import z from "zod";
import log from "../log";

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

export class OverseerrClient {
  constructor(private a: { host: string; apiKey: string }) {}

  private async get(path: string) {
    const url = `${this.a.host}/api/v1${path}`;
    log.debug({ url }, "fetching from Overseerr");
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": this.a.apiKey },
    });
    return res.json();
  }

  async getApprovedRequests() {
    const schema = z.object({
      results: z.array(
        z.object({
          id: z.number(),
          media: z.object({
            mediaType: z.enum(["movie", "tv"]),
            tmdbId: z.number(),
          }),
          seasons: z.array(z.object({ seasonNumber: z.number() })),
        })
      ),
    });
    const resp = await this.get(`/request?take=99999999&filter=approved`);
    return schema.parse(resp).results; // TODO: error handling
  }

  async getRequest(id: number): Promise<OverseerrRequest> {
    return this.get(`/request/${id}`);
  }

  async getSeason(tmdbID: number, season: number) {
    const schema = z.object({
      episodes: z.array(
        z.object({
          episodeNumber: z.number(),
          airDate: z.string(),
        })
      ),
    });
    const resp = await this.get(`/tv/${tmdbID}/season/${season}`);
    return schema.parse(resp); // TODO: error handling
  }

  async getMetadataMovie(tmdbID: number) {
    const schema = z.object({
      title: z.string(),
      releaseDate: z.string(),
      externalIds: z.object({ imdbId: z.string() }),
    });
    const resp = await this.get(`/movie/${tmdbID}`);
    return schema.parse(resp); // TODO: error handling
  }

  async getMetadataTV(tmdbID: number) {
    const schema = z.object({
      name: z.string(),
      externalIds: z.object({ imdbId: z.string() }),
    });
    const resp = await this.get(`/tv/${tmdbID}`);
    return schema.parse(resp); // TODO: error handling
  }

  async getMetadataForApprovedRequests(): Promise<OverseerrRequest[]> {
    const requests = await this.getApprovedRequests();
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
          episodes: s.data.episodes.map((e) => ({
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
