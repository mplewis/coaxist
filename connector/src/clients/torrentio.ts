import { ZodIssue, z } from "zod";
import log from "../log";
import { DebridCreds, buildDebridPathPart } from "../data/debrid";
import { ToFetch } from "../logic/list";
import { VERSION } from "../util/version";
import { DiskCache } from "../store/diskCache";
import { RequestError, getJSON } from "./http";

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

function get(cache: DiskCache<TorrentioSearchResult[]>, url: string) {
  return cache.get<ZodIssue | RequestError>(url, async () => {
    log.debug({ url }, "fetching from Torrentio");
    const result = await getJSON(url, torrentioSearchResultsSchema);
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

export async function searchTorrentio(
  creds: DebridCreds,
  cache: DiskCache<TorrentioSearchResult[]>,
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
  const r = await get(cache, url);
  if (!r.success) {
    log.warn({ url, errors: r.errors }, "error fetching from Torrentio");
    return null;
  }
  return r.data;
}

export function snatchViaURL(s: Snatchable) {
  log.debug({ url: s.snatchURL }, "snatching via Torrentio");
  return fetch(s.snatchURL, { method: "HEAD", headers });
}
