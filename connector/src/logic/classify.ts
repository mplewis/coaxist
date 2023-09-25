import { QUALITY_MATCHERS, Quality } from "../data/quality";
import { TAG_MATCHERS, Tag } from "../data/tag";
import {
  TorrentioResultMetadata,
  parseFromTokens,
  parseTorrentioTitle,
  tokenize,
} from "./parse";
import { TorrentioSearchResult } from "../clients/torrentio";
import { ContainedMediaType } from "./profile";

const SEASON_MATCHER = /\bs(\d+)\b/i;
const EPISODE_MATCHER = /\bs(\d+)e(\d+)\b/i;

/** Information parsed from a torrent's raw title. */
export type TorrentInfo = Classification &
  TorrentioResultMetadata & {
    mediaType: ContainedMediaType;
    originalResult: TorrentioSearchResult;
  };

/** A piece of media that has been classified with a known quality, numbering (if applicable), and tagged. */
export type Classification = { quality: Quality; tags: Tag[] } & Numbering;

/** The numbering of a piece of series media. */
export type Numbering =
  | { mediaType: "episode"; season: number; episode: number }
  | { mediaType: "season"; season: number }
  | { mediaType: "movie" };

/** Classify a torrent based on its raw name. */
export function classify(s: string): Classification | null {
  const tokens = tokenize(s);
  const quality = parseFromTokens(tokens, QUALITY_MATCHERS)[0] as Quality;
  if (!quality) return null;
  const tags = parseFromTokens(tokens, TAG_MATCHERS) as Tag[];

  if (s.match(EPISODE_MATCHER)) {
    const [, seasonRaw, episodeRaw] = s.match(EPISODE_MATCHER)!;
    const season = parseInt(seasonRaw, 10);
    const episode = parseInt(episodeRaw, 10);
    return { quality, tags, season, episode, mediaType: "episode" };
  }
  if (s.match(SEASON_MATCHER)) {
    const [, seasonRaw] = s.match(SEASON_MATCHER)!;
    const season = parseInt(seasonRaw, 10);
    return { quality, tags, season, mediaType: "season" };
  }
  return { quality, tags, mediaType: "movie" };
}

/**
 * Build numbering from the torrent and filename.
 * Since we're parsing info for a torrent, if the torrent is for an entire season,
 * return the torrent's season rather than the file's episode number.
 */
function numberingFrom(
  filename: Classification | null,
  torrent: Classification | null
): Numbering {
  if (torrent && "season" in torrent && !("episode" in torrent)) return torrent; // Torrent is for a full season
  if (filename && "episode" in filename) return filename;
  if (filename && "season" in filename) return filename;
  if (torrent && "season" in torrent) return torrent;
  return { mediaType: "movie" };
}

/** Parse info from the raw Torrentio title data and build a complete TorrentInfo. */
export function classifyTorrentioResult(
  tsr: TorrentioSearchResult
): TorrentInfo | null {
  const parsed = parseTorrentioTitle(tsr.title);
  if (!parsed) return null;
  const { torrentLine, filenameLine, seeders, bytes, tracker } = parsed;

  const cl: Classification | null = (() => {
    if (!torrentLine) return classify(filenameLine);

    // The filename is often more descriptive than the torrent name, so prefer it
    const clF = classify(filenameLine);
    const clT = classify(torrentLine);
    const quality = (clF && clF.quality) || (clT && clT.quality);
    if (!quality) return null;
    const tagsT = (clT && clT.tags) || [];
    const tagsF = (clF && clF.tags) || [];
    const tags = [...new Set([...tagsT, ...tagsF])].sort();
    return { ...numberingFrom(clF, clT), quality, tags };
  })();
  if (!cl) return null;

  return { ...cl, tracker, seeders, bytes, originalResult: tsr };
}
