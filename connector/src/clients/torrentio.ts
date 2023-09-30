import { z } from "zod";
import { cacheFor } from "../util/cache";
import { errorForResponse } from "../util/fetch";
import log from "../log";
import { DebridCreds, buildDebridPathPart } from "../data/debrid";
import { ToFetch } from "../logic/list";
import { VERSION } from "../util/version";

const TORRENTIO_HOST = "https://torrentio.strem.fun";

const cache = cacheFor("torrentio");

const headers = {
  "User-Agent": `Coaxist-Connector/${VERSION}; github.com/mplewis/coaxist`,
};

/** A Torrentio URL that can be used to load an item into Debrid. */
export type Snatchable = {
  snatchURL: string;
};

const torrentioSearchResultsSchema = z.object({ streams: z.array(z.any()) });

const torrentioSearchResultSchema = z.object({
  name: z.string(),
  title: z.string(),
  url: z.string(),
});
export type TorrentioSearchResult = z.infer<typeof torrentioSearchResultSchema>;

function get(url: string) {
  log.debug({ url }, "fetching from Torrentio");
  return cache.getJSON(url, () => fetch(url, { headers }));
}

export async function searchTorrentio(
  creds: DebridCreds,
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
  const r = await get(url);
  if (!r.ok) {
    const error = await errorForResponse(r.res);
    log.warn(
      { url, status: r.res.status, error },
      "error fetching from Torrentio"
    );
    return null;
  }

  const wrapper = torrentioSearchResultsSchema.safeParse(r.json);
  if (!wrapper.success) {
    log.warn({ url, error: wrapper.error }, "malformed Torrentio result");
    return null;
  }

  const results: TorrentioSearchResult[] = [];
  for (const s of wrapper.data.streams) {
    const rs = torrentioSearchResultSchema.safeParse(s);
    if (!rs.success) {
      log.warn({ s, error: rs.error }, "malformed Torrentio result");
      continue;
    }
    results.push(rs.data);
  }
  return results;
}

export function snatchViaURL(s: Snatchable) {
  log.debug({ url: s.snatchURL }, "snatching via Torrentio");
  return fetch(s.snatchURL, { method: "HEAD", headers });
}
