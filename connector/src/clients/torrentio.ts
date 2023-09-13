import { parseTorrentioTitle } from "../logic/parse";
import { cacheFor } from "../util/cache";

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

/** A search result from Torrentio. */
export type TorrentioResult = {
  /** The full raw title of the torrent */
  title: string;
  /** The hash for the torrent */
  infoHash: string;
  /** The index of the file in the torrent's full data */
  fileIdx: number;
};

export async function search(media: Media): Promise<TorrentioResult[]> {
  // TODO
}

export function buildDebridFetchURL(
  creds: DebridCreds,
  result: TorrentioResult
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
