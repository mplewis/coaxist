import { z } from "zod";
import { parseTorrentioTitle } from "../logic/parse";
import { cacheFor } from "../util/cache";
import { errorForResponse } from "../util/fetch";
import { VERSION } from "../util/config";
import log from "../log";

const TORRENTIO_HOST = "https://torrentio.strem.fun";

const cache = cacheFor("torrentio");

const headers = {
  "User-Agent": `Coaxist-Connector/${VERSION}; github.com/mplewis/coaxist`,
};

/** Credentials for connecting to Debrid. */
export type DebridCreds = {
  /** The API key for AllDebrid */
  allDebridAPIKey: string;
};

/** A piece of media to search Torrentio for. */
export type Media = { imdbID: string } & (
  | {}
  | { season: number; episode: number }
);

/** A Torrentio URL that can be used to load an item into Debrid. */
export type Snatchable = {
  snatchURL: string;
};

const torrentioSearchResultsSchema = z.object({ streams: z.array(z.any()) });

const torrentioSearchResultSchema = z.object({
  title: z.string(),
  infoHash: z.string(),
  // HACK: Torrentio sometimes returns missing fileIdx for single episode torrents.
  // In this case, we don't care, because conversion of a single torrent to a
  // Debrid URL will use null for the url index param anyway. So just put something here.
  fileIdx: z.number().default(0),
});
export type TorrentioSearchResult = z.infer<typeof torrentioSearchResultSchema>;

function get(url: string) {
  log.debug({ url }, "fetching from Torrentio");
  return cache.getJSON(url, () => fetch(url, { headers }));
}

export async function searchTorrentio(
  media: Media
): Promise<TorrentioSearchResult[] | null> {
  const type = "episode" in media ? "series" : "movie";
  const slug =
    "episode" in media
      ? `${media.imdbID}:${media.season}:${media.episode}`
      : `${media.imdbID}`;

  const url = `${TORRENTIO_HOST}/stream/${type}/${slug}.json`;
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

export function buildDebridFetchURL(
  creds: DebridCreds,
  result: TorrentioSearchResult
): string | null {
  const parsed = parseTorrentioTitle(result.title);
  if (!parsed) return null;

  const { allDebridAPIKey } = creds;
  const { fileIdx } = result;
  const bits = [
    "alldebrid",
    allDebridAPIKey,
    result.infoHash,
    parsed.filenameLine,
    parsed.torrentLine ? fileIdx : "null",
    parsed.filenameLine,
  ];
  return `${TORRENTIO_HOST}/${bits.map(encodeURIComponent).join("/")}`;
}
