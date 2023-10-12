import { ZodIssue, z } from "zod";

import { DebridCreds, buildDebridPathPart } from "../data/debrid";
import log from "../log";
import { ToFetch } from "../logic/list";
import { Cache } from "../store/cache";
import { VERSION } from "../util/version";

import { RequestError, fetchResp, getJSON } from "./http";

const TORRENTIO_HOST = "https://torrentio.strem.fun";

const headers = {
  "User-Agent": `Coaxist-Connector/${VERSION}; github.com/mplewis/coaxist`,
};

/** A Torrentio URL that can be used to load an item into Debrid. */
export type Snatchable = {
  snatchURL: string;
};

const torrentioSearchResultsSchema = z.object({ streams: z.array(z.any()) });

export const torrentioSearchResultSchema = z.object({
  name: z.string(),
  title: z.string(),
  url: z.string(),
});
export type TorrentioSearchResult = z.infer<typeof torrentioSearchResultSchema>;

function get(cache: Cache<TorrentioSearchResult[]>, desc: string, url: string) {
  return cache.get<ZodIssue | RequestError>(url, async () => {
    const result = await getJSON(desc, url, torrentioSearchResultsSchema);
    if (!result.success) return result;

    const unverified = result.data.streams;
    const verified: TorrentioSearchResult[] = [];
    for (const s of unverified) {
      const rs = torrentioSearchResultSchema.safeParse(s);
      if (rs.success) {
        verified.push(rs.data);
      } else {
        log.warn({ s, error: rs.error }, "malformed Torrentio result");
      }
    }

    return { success: true, data: verified };
  });
}

/** Search Torrentio for a piece of media. */
export async function searchTorrentio(
  creds: DebridCreds,
  cache: Cache<TorrentioSearchResult[]>,
  media: ToFetch
): Promise<TorrentioSearchResult[] | null> {
  const debridPathPart = buildDebridPathPart(creds);
  const typeAndSlug = (() => {
    if ("episode" in media)
      return `series/${media.imdbID}:${media.season}:${media.episode}`;
    if ("season" in media) return `series/${media.imdbID}:${media.season}:1`;
    return `movie/${media.imdbID}`;
  })();

  const url = `${TORRENTIO_HOST}/${debridPathPart}/stream/${typeAndSlug}.json`;
  const r = await get(cache, "searching Torrentio", url);
  if (!r.success) {
    log.warn({ url, errors: r.errors }, "error fetching from Torrentio");
    return null;
  }
  return r.data;
}

/** Snatch media into a Debrid account via Torrentio URL. */
export function snatchViaURL(s: Snatchable) {
  return fetchResp("snatching via Torrentio", s.snatchURL, {
    method: "HEAD",
    headers,
  });
}
