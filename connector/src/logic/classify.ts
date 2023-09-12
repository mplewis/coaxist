import * as R from "remeda";
import parseBytes from "bytes";
import { QUALITY_MATCHERS, QUALITY_RANKING, Quality } from "../data/quality";
import { TAG_MATCHERS, Tag } from "../data/tag";
import { parseFromTokens, tokenize } from "./parse";
import { Profile, isPreferred, satisfies } from "./profile";

const SEASON_MATCHER = /\bs(\d+)\b/i;
const EPISODE_MATCHER = /\bs(\d+)e(\d+)\b/i;
const SEEDERS_MATCHER = /👤\s*(\d+)/;
const SIZE_MATCHER = /💾\s*([\d.]+\s*[A-Za-z]*B)/;
const TRACKER_MATCHER = /⚙️\s*(.+)/;

/** Information parsed from a torrent's raw title. */
export type TorrentInfo = Classification & {
  tracker: string;
  seeders: number;
  bytes: number;
  url: string;
};

/** A piece of media that has been classified with a known quality, numbering (if applicable), and tagged. */
export type Classification = { quality: Quality; tags: Tag[] } & Numbering;

/** The numbering of a piece of series media. */
export type Numbering =
  | { season: number; episode: number }
  | { season: number }
  | {};

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
    return { quality, tags, season, episode };
  }
  if (s.match(SEASON_MATCHER)) {
    const [, seasonRaw] = s.match(SEASON_MATCHER)!;
    const season = parseInt(seasonRaw, 10);
    return { quality, tags, season };
  }
  return { quality, tags };
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
  return {};
}

/** Parse info from the raw title of a torrent and build a complete TorrentInfo. */
export function parseTorrentInfo(
  torrentioTitle: string,
  url: string
): TorrentInfo | null {
  const lines = torrentioTitle.split("\n");

  // Always present. Looks like: 👤 89 💾 5.76 GB ⚙️ ThePirateBay
  const metaLineIdx = lines.findIndex((l) => l.includes("👤"));
  if (!metaLineIdx) return null;
  const metaLine = lines[metaLineIdx];

  const seedersMatch = metaLine.match(SEEDERS_MATCHER);
  const seeders = seedersMatch ? parseInt(seedersMatch[1], 10) : -1;
  const sizeMatch = metaLine.match(SIZE_MATCHER);
  const sizeRaw = sizeMatch ? sizeMatch[1] : null;
  const bytes = sizeRaw ? parseBytes(sizeRaw) : -1;
  const trackerMatch = metaLine.match(TRACKER_MATCHER);
  const tracker = trackerMatch ? trackerMatch[1] : "<unknown>";

  // Always present. The name of the file. Doesn't always include an extension.
  const fnLineIdx = metaLineIdx - 1;
  const fnLine = lines[fnLineIdx];

  // Sometimes present. The name of the torrent, if it's for more than one file.
  const torrentLineIdx = metaLineIdx - 2;
  const torrentLine = lines[torrentLineIdx];

  const cl: Classification | null = (() => {
    if (!fnLine) return null;
    if (!torrentLine) return classify(fnLine);

    // The filename is often more descriptive than the torrent name, so prefer it
    const clF = classify(fnLine);
    const clT = classify(torrentLine);
    const quality = (clF && clF.quality) || (clT && clT.quality);
    if (!quality) return null;
    const tagsT = (clT && clT.tags) || [];
    const tagsF = (clF && clF.tags) || [];
    const tags = [...new Set([...tagsT, ...tagsF])].sort();
    return { ...numberingFrom(clF, clT), quality, tags };
  })();
  if (!cl) return null;

  return { ...cl, tracker, seeders, bytes, url };
}

/** Build an ordered list of candidates, grouped by quality in descending order. */
function groupByQualityDesc<T extends { quality: Quality }>(cands: T[]): T[][] {
  const lookup: Record<Quality, T[]> = R.groupBy(cands, (c) => c.quality);
  return QUALITY_RANKING.map((q) => lookup[q] ?? []);
}

/**
 * Pick the best candidate for a profile from a list of torrents.
 * @returns the best candidate, or `null` if none are acceptable
 */
export function pickBest(
  profile: Profile,
  candidates: TorrentInfo[]
): TorrentInfo | null {
  const acceptable = candidates.filter((c) => satisfies(profile, c));
  if (acceptable.length === 0) return null;

  const [preferred, fallback] = R.partition(acceptable, (c) =>
    isPreferred(profile, c)
  );
  const groups = [
    ...groupByQualityDesc(preferred),
    ...groupByQualityDesc(fallback),
  ].filter((g) => g.length > 0);
  const bestGroup = groups[0];
  return R.maxBy(bestGroup, (c) => c.seeders) ?? null;
}
