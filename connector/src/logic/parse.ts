import parseBytes from "bytes";
import { findSlidingWindowMatch } from "../util/search";
import { TokenMatcher } from "./classify.types";
import log from "../log";

const TOKEN_SPLITTER = /[\s.]+/;
const CACHED_MATCHER = /\[(RD|PM|AD|DL|OC|Putio)\+\]/;
const GROUP_SUFFIX_MATCHER = /([^-]+)-(.+)$/; // x265-SomeGroup -> x265
const SEEDERS_MATCHER = /👤\s*(\d+)/;
const SIZE_MATCHER = /💾\s*([\d.]+\s*[A-Za-z]*B)/;
const TRACKER_MATCHER = /⚙️\s*(.+)/;
const VIDEO_EXTENSIONS = ["mkv", "mp4", "avi", "wmv", "mov", "flv", "webm"];

/** Semi-parsed fields for a Torrentio search result. */
export type TorrentioFields = {
  /** If this torrent is for multiple files, the name of the torrent */
  torrentLine?: string;
  /** The name of the search result file */
  filenameLine: string;
} & TorrentioResultMetadata;

/** Metadata for a Torrentio search result */
export type TorrentioResultMetadata = {
  /** The tracker where we found this torrent */
  tracker: string;
  /** The number of seeders for this torrent */
  seeders: number;
  /** The total size of this torrent */
  bytes: number;
  /** Whether this torrent is cached on the Debrid service */
  cached: boolean;
};

/** Drop the last token if it's a video extension. */
function dropVideoExtension(tokens: string[]): string[] {
  const last = tokens[tokens.length - 1];
  if (VIDEO_EXTENSIONS.includes(last))
    return tokens.slice(0, tokens.length - 1);
  return tokens;
}

/** Strip the given characters from the given string. */
function stripChars(chars: string, s: string): string {
  return chars.split("").reduce((r, c) => r.replace(c, ""), s);
}

/** Convert a raw torrent name to parsable tokens. */
export function tokenize(s: string): string[] {
  const x = s.toLowerCase();
  const tok = dropVideoExtension(
    x
      .split(TOKEN_SPLITTER)
      .filter(Boolean)
      .map((t) => stripChars("![]()-", t))
  );
  const leaveHyphens = dropVideoExtension(
    x
      .split(TOKEN_SPLITTER)
      .filter(Boolean)
      .map((t) => stripChars("![]()", t))
  );
  const last = leaveHyphens[leaveHyphens.length - 1];
  const match = last.match(GROUP_SUFFIX_MATCHER);
  if (match) {
    const tagWithoutGroup = match[1];
    tok[tok.length - 1] = tagWithoutGroup;
  }
  return tok;
}

/** Parse known values from a series of raw tokens using a series of matchers. */
export function parseFromTokens(
  tokens: string[],
  matchers: readonly TokenMatcher[]
): string[] {
  let tok = [...tokens];
  const found = new Set<string>();

  for (const matcher of matchers) {
    const { name: tag, match: candidates } = matcher;
    const consume = "consume" in matcher ? matcher.consume : false;

    for (const cand of candidates) {
      const result = findSlidingWindowMatch(tok, cand);
      if (result.match) {
        found.add(tag);
        if (consume) {
          tok = [
            ...tok.slice(0, result.index),
            ...tok.slice(result.index + cand.length),
          ];
        }
        break;
      }
    }
  }

  return [...found].sort();
}

/** Parse info from the raw title of a Torrentio result. */
export function parseTorrentioRawText(
  name: string,
  title: string
): TorrentioFields | null {
  const lines = title.split("\n");

  // Always present. Looks like: 👤 89 💾 5.76 GB ⚙️ ThePirateBay
  const metaLineIdx = lines.findIndex((l) => l.includes("👤"));
  if (!metaLineIdx) {
    log.warn({ title }, "metadata line not found for Torrentio result");
    return null;
  }
  const metaLine = lines[metaLineIdx];

  // Always present. The name of the file. Doesn't always include an extension.
  const filenameLineIdx = metaLineIdx - 1;
  const filenameLine = lines[filenameLineIdx];
  if (!filenameLine) {
    log.warn({ title }, "filename line not found for Torrentio result");
    return null;
  }

  // Sometimes present. The name of the torrent, if it's for more than one file.
  const torrentLineIdx = metaLineIdx - 2;
  const torrentLine = lines[torrentLineIdx];

  // Always present, but be defensive
  const seedersMatch = metaLine.match(SEEDERS_MATCHER);
  const seeders = seedersMatch ? parseInt(seedersMatch[1], 10) : -1;
  const sizeMatch = metaLine.match(SIZE_MATCHER);
  const sizeRaw = sizeMatch ? sizeMatch[1] : null;
  const bytes = sizeRaw ? parseBytes(sizeRaw) : -1;
  const trackerMatch = metaLine.match(TRACKER_MATCHER);
  const tracker = trackerMatch ? trackerMatch[1] : "<unknown>";

  const cached = CACHED_MATCHER.test(name);

  return { seeders, bytes, tracker, cached, torrentLine, filenameLine };
}
