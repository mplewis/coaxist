export type OverseerrRequest = {
  id: number;
  media: { mediaType: "movie" | "tv"; tmdbId: number; tvdbId: number };
  seasons: { seasonNumber: number }[];
};

export type OverseerrMetadata = {
  name: string;
  externalIds: { imdbId: string };
};

export type OverseerrSeason = {
  seasonNumber: number;
  episodes: [
    {
      episodeNumber: number;
      /** Episode air date in YYYY-MM-DD format */
      airDate: string;
    },
  ];
};

export class OverseerrClient {
  constructor(private a: { host: string; apiKey: string }) {}

  private async get(path: string) {
    const url = `http://${this.a.host}/api/v1${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": this.a.apiKey },
    });
    return res.json();
  }

  async getApprovedRequests(): Promise<OverseerrRequest[]> {
    const resp = await this.get(`/request?take=99999999&filter=approved`);
    return resp.results;
  }

  async getRequest(id: number): Promise<OverseerrRequest> {
    return this.get(`/request/${id}`);
  }

  async getSeason(tmdbID: number, season: number): Promise<OverseerrSeason> {
    return this.get(`/tv/${tmdbID}/season/${season}`);
  }

  async getMetadata(
    type: "movie" | "tv",
    tmdbID: number
  ): Promise<OverseerrMetadata> {
    const raw = await this.get(`/${type}/${tmdbID}`);
    if (raw.title) raw.name = raw.title;
    return raw;
  }

  async getMetadataForApprovedRequests() {
    const requests = await this.getApprovedRequests();
    const inFlight = requests.map(async (request) => {
      const { mediaType, tmdbId } = request.media;
      const metadata = await this.getMetadata(mediaType, tmdbId);
      const seasons = await Promise.all(
        request.seasons.map(async (season) =>
          this.getSeason(tmdbId, season.seasonNumber)
        )
      );
      return { request, metadata, seasons };
    });
    return Promise.all(inFlight);
  }
}
