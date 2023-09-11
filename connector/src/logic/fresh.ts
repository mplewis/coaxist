import ms from "ms";
import * as R from "remeda";
import z from "zod";
import { OverseerrFullRequestInfo } from "../clients/overseerr";

const SNATCH_EXPIRY = ms("15d"); // debrid services often expire files at 15 days
const REFRESH_WITHIN_EXPIRY = ms("2d"); // refresh snatch if within 3 days of expiry
const SEARCH_FOR_EPS_BEFORE_RELEASE_WITHIN = ms("7d"); // search for episodes up to 7 days before their official release date

export type Snatch = {
  snatchedAt: Date;
  url: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
} & ({} | { season: number } | { season: number; episode: number });

export type Criteria = {
  quality: string[];
  tags: Tag[];
};

export type Profile = {
  name: string;
  minimum?: { quality: Quality };
  maximum?: { quality: Quality };
  required?: Partial<Criteria>;
  discouraged?: Partial<Criteria>;
  forbidden?: Partial<Criteria>;
};

const myProfiles: Profile[] = [
  {
    name: "Best Available",
    discouraged: { tags: ["remux"] },
  },
  {
    name: "Accessible",
    maximum: { quality: "1080p" },
    forbidden: { tags: ["remux", "hdr"] },
  },
];

function isStale(snatchedAt: Date, now = new Date()) {
  const deadline = new Date(
    snatchedAt.getTime() + SNATCH_EXPIRY - REFRESH_WITHIN_EXPIRY
  );
  return now > deadline;
}

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

// if the season is stale and all episodes are available, refresh the season
// otherwise, if any episodes are stale, refresh them

export function staleRequests(
  requestInfos: OverseerrFullRequestInfo[],
  snatches: Snatch[]
) {
  const snatchesByRequest = correlateSnatches(requestInfos, snatches);
  const [movies, tvs] = R.partition(
    snatchesByRequest,
    (x) => x.info.request.media.mediaType === "movie"
  );
}
