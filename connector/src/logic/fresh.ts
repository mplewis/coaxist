import { OverseerrFullRequestInfo } from "../clients/overseerr";

export type Snatch = {
  snatchedAt: Date;
  url: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
} & ({} | { season: number } | { season: number; episode: number });

export function correlateSnatches(
  requestInfos: OverseerrFullRequestInfo[],
  snatches: Snatch[]
) {
  const snatchesByRequest: Record<
    string,
    { info: OverseerrFullRequestInfo; snatches: Snatch[] }
  > = {};

  const idFor = (mediaType: "movie" | "tv", tmdbID: number) =>
    `${mediaType}_${tmdbID}`;

  for (const ri of requestInfos) {
    const id = idFor(ri.request.media.mediaType, ri.request.media.tmdbId);
    snatchesByRequest[id] = { info: ri, snatches: [] };
  }

  for (const snatch of snatches) {
    const id = idFor(snatch.mediaType, snatch.tmdbId);
    const entry = snatchesByRequest[id];
    if (entry) entry.snatches.push(snatch);
  }

  return Object.values(snatchesByRequest);
}
