import { TorrentioSearchResult } from "../clients/torrentio";
import { QUALITY_MATCHERS, Quality } from "../data/quality";
import { TAG_MATCHERS, Tag } from "../data/tag";
import log from "../log";

import {
  TorrentioResultMetadata,
  parseFromTokens,
  parseTorrentioRawText,
  tokenize,
} from "./parse";
import { ContainedMediaType } from "./rank";

const ASSUMED_QUALITY = "1080p"; // If we can't determine a quality, fall back to this
const SEASON_MATCHER = /\bs(\d+)\b/i;
const EPISODE_MATCHER = /\bs(\d+)e(\d+)\b/i;

/** Information parsed from a torrent's raw title. */
export type TorrentInfo = Classification &
  TorrentioResultMetadata & {
    mediaType: ContainedMediaType;
    originalResult: TorrentioSearchResult;
  };

export type ClassificationMaybeQuality = {
  quality?: Quality;
  tags: Tag[];
} & Numbering;

/** A piece of media that has been classified with a known quality, numbering (if applicable), and tagged. */
export type Classification = { quality: Quality; tags: Tag[] } & Numbering;

/** The numbering of a piece of series media. */
export type Numbering =
  | { mediaType: "episode"; season: number; episode: number }
  | { mediaType: "season"; season: number }
  | { mediaType: "movie" };

/** Classify a torrent based on its raw name. */
export function classify(s: string): ClassificationMaybeQuality {
  const tokens = tokenize(s);
  const quality = parseFromTokens(tokens, QUALITY_MATCHERS)[0] as
    | Quality
    | undefined;
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

function assumeQualityIfUnset(c: ClassificationMaybeQuality): Classification {
  if (c.quality) return c as Classification;
  return { ...c, quality: ASSUMED_QUALITY };
}

/**
 * Build numbering from the torrent and filename.
 * Since we're parsing info for a torrent, if the torrent is for an entire season,
 * return the torrent's season rather than the file's episode number.
 */
function numberingFrom(
  filename: Numbering | null,
  torrent: Numbering | null
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
  const parsed = parseTorrentioRawText(tsr.name, tsr.title);
  if (!parsed) {
    log.warn({ tsr }, "Failed to parse Torrentio result");
    return null;
  }
  const { torrentLine, filenameLine, seeders, bytes, tracker, cached } = parsed;

  const cl: Classification | null = (() => {
    if (!torrentLine) return assumeQualityIfUnset(classify(filenameLine));

    // The filename is often more descriptive than the torrent name, so prefer it
    const clF = classify(filenameLine);
    const clT = classify(torrentLine);
    const quality = clF?.quality || clT?.quality;
    const tagsT = (clT && clT.tags) || [];
    const tagsF = (clF && clF.tags) || [];
    const tags = [...tagsT, ...tagsF];
    return assumeQualityIfUnset({ ...numberingFrom(clF, clT), quality, tags });
  })();
  if (!cl) return null;

  const ct: Tag[] = cached ? ["cached"] : [];
  cl.tags = [...new Set([...cl.tags, ...ct])].sort();

  return { ...cl, tracker, seeders, bytes, cached, originalResult: tsr };
}
