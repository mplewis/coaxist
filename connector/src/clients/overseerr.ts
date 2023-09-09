export type OverseerrRequest = {
  id: number;
  media: { mediaType: "movie" | "tv"; tmdbId: number; tvdbId: number };
  seasons: { seasonNumber: number }[];
};

export type OverseerrMetadata = { externalIds: { imdbId: string } };

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

  async getMetadata(
    type: "movie" | "tv",
    tmdbID: number
  ): Promise<OverseerrMetadata> {
    return this.get(`/${type}/${tmdbID}`);
  }

  async getMetadataForApprovedRequests(): Promise<
    { request: OverseerrRequest; metadata: OverseerrMetadata }[]
  > {
    const requests = await this.getApprovedRequests();
    const inFlight = requests.map(async (request) => {
      const { mediaType, tmdbId } = request.media;
      const metadata = await this.getMetadata(mediaType, tmdbId);
      return { request, metadata };
    });
    return Promise.all(inFlight);
  }
}
