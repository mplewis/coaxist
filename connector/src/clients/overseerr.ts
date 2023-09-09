export type OverseerrRequest = {
  id: number;
  media: { tmdbId: number; tvdbId: number };
  seasons: { seasonNumber: number }[];
};

export class OverseerrClient {
  constructor(private host: string, private apiKey: string) {}

  async getApprovedRequests() {
    const res = await fetch(
      `http://${this.host}/api/v1/request?take=99999999&filter=approved`,
      { method: "GET", headers: { "X-Api-Key": this.apiKey } }
    );
    const json = await res.json();
    return json.results as OverseerrRequest[];
  }

  async getRequest(id: number) {
    const res = await fetch(`http://${this.host}/api/v1/request/${id}`, {
      method: "GET",
      headers: { "X-Api-Key": this.apiKey },
    });
    const json = await res.json();
    return json as OverseerrRequest;
  }
}
