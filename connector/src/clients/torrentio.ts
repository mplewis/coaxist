import { z } from "zod";
import { parseTorrentioTitle } from "../logic/parse";
import { cacheFor } from "../util/cache";
import { errorForResponse } from "../util/fetch";

const TORRENTIO_HOST = "https://torrentio.strem.fun";

const cache = cacheFor("torrentio");

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

const torrentioSearchResultsSchema = z.object({ streams: z.array(z.any()) });

const torrentioSearchResultSchema = z.object({
  title: z.string(),
  infoHash: z.string(),
  fileIdx: z.number(),
});
type TorrentioSearchResult = z.infer<typeof torrentioSearchResultSchema>;

export async function search(
  media: Media
): Promise<
  { ok: true; results: TorrentioSearchResult[] } | { ok: false; error: string }
> {
  const type = "episode" in media ? "series" : "movie";
  const slug =
    "episode" in media
      ? `${media.imdbID}:${media.season}:${media.episode}`
      : `${media.imdbID}`;
  const url = `${TORRENTIO_HOST}/stream/${type}/${slug}.json`;
  console.log(url);

  const r = await cache.getJSON(url, () => fetch(url));
  if (!r.ok) return { ok: false, error: await errorForResponse(r.res) };

  const wrapper = torrentioSearchResultsSchema.safeParse(r.json);
  if (!wrapper.success) return { ok: false, error: wrapper.error.message };

  const results: TorrentioSearchResult[] = [];
  wrapper.data.streams.forEach((s) => {
    const rs = torrentioSearchResultSchema.safeParse(s);
    if (rs.success) results.push(rs.data);
    else console.error(`Malformed Torrentio result: ${rs.error.message}: ${s}`);
  });
  return { ok: true, results };
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
