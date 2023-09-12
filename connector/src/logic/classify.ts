type TokenMatcher = {
  name: string;
  match: readonly (string | readonly string[])[];
  consume?: boolean;
};
type Matchers = TokenMatcher["match"];

const QUALITY_MATCHERS = [
  { name: "2160p", match: ["2160p", "4k"] },
  { name: "1080p", match: ["1080p", "fullhd", "fhd"] },
  { name: "720p", match: ["720p"] },
  { name: "576p", match: ["576p", "pal"] },
  { name: "480p", match: ["480p", "ntsc", "sd"] },
] as const satisfies readonly TokenMatcher[];
export const QUALITY_RANKING = QUALITY_MATCHERS.map((m) => m.name);
export type Quality = (typeof QUALITY_MATCHERS)[number]["name"];

export const Q1_HIGHER = -1;
export const Q2_HIGHER = 1;
export const EQUAL = 0;
/** A compare function for sorting Qualities, highest quality first. */
export function sortQuality(
  q1: Quality,
  q2: Quality
): typeof Q1_HIGHER | typeof Q2_HIGHER | typeof EQUAL {
  const q1i = QUALITY_RANKING.indexOf(q1);
  const q2i = QUALITY_RANKING.indexOf(q2);
  if (q1i < q2i) return Q1_HIGHER;
  if (q1i > q2i) return Q2_HIGHER;
  return EQUAL;
}

const brremux = ["bdremux", "brremux"];
const dolbyvision: Matchers = ["dv", ["dolby", "vision"]];
const hdr10: Matchers = ["hdr10"];
const hdr10plus: Matchers = ["hdr10plus", ["hdr10", "plus"], "hdr10+"];
const hdr = [...hdr10, ...hdr10plus, ...dolbyvision, "hdr", "10bit"];

export const TAG_MATCHERS = [
  // video features
  { name: "hdr", match: hdr },
  { name: "hdr10", match: hdr10 },
  { name: "hdr10plus", match: hdr10plus },
  { name: "dolbyvision", match: dolbyvision },
  { name: "h265", match: ["x265", "h265", ["x", "265"], ["h", "265"], "hevc"] },
  { name: "h264", match: ["x264", "h264", ["x", "264"], ["h", "264"], "avc"] },

  // source/quality
  { name: "remux", match: ["remux", ...brremux] },
  { name: "bluray", match: ["bluray", ...brremux] },
  { name: "web", match: ["web", "webdl", "webrip"] },
  { name: "hdtv", match: ["hdtv", "hdrip"] },
  {
    name: "cam",
    match: ["cam", "camrip", "hdts", "ts", "telesync", "telecine", "hdcam"],
  },

  // internationalization
  { name: "hardsub", match: ["hc"] },
  { name: "multisub", match: [["multi", "sub"]], consume: true },
  { name: "dualaudio", match: ["dual"] },
  { name: "multiaudio", match: ["multi"] },
] as const satisfies readonly TokenMatcher[];
export type Tag = (typeof TAG_MATCHERS)[number]["name"];

/** A piece of media that has been classified with a known quality, numbering (if applicable), and tagged. */
export type Classification = { quality: Quality; tags: Tag[] } & Numbering;

/** The numbering of a piece of series media. */
export type Numbering =
  | { season: number; episode: number }
  | { season: number }
  | {};

const TOKEN_SPLITTER = /[\s.]+/;
const SEASON_MATCHER = /\bs(\d+)\b/i;
const EPISODE_MATCHER = /\bs(\d+)e(\d+)\b/i;
const GROUP_SUFFIX_MATCHER = /([^-]+)-(.+)$/; // x265-SomeGroup -> x265
const VIDEO_EXTENSIONS = ["mkv", "mp4", "avi", "wmv", "mov", "flv", "webm"];

/** Drop the last token if it's a video extension. */
function dropVideoExtension(tokens: string[]): string[] {
  const last = tokens[tokens.length - 1];
  if (VIDEO_EXTENSIONS.includes(last))
    return tokens.slice(0, tokens.length - 1);
  return tokens;
}

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
      .map((t) => stripChars("[]()-", t))
  );
  const leaveHyphens = dropVideoExtension(
    x
      .split(TOKEN_SPLITTER)
      .filter(Boolean)
      .map((t) => stripChars("[]()", t))
  );
  const last = leaveHyphens[leaveHyphens.length - 1];
  const match = last.match(GROUP_SUFFIX_MATCHER);
  if (match) {
    const tagWithoutGroup = match[1];
    tok[tok.length - 1] = tagWithoutGroup;
  }
  return tok;
}

/** Find the first match in an array for a single term or series of terms. */
export function findSlidingWindowMatch(
  tokens: string[],
  match: string | readonly string[]
): { match: true; index: number } | { match: false } {
  const m = typeof match === "string" ? [match] : match;
  for (let i = 0; i < tokens.length - (m.length - 1); i++) {
    let matches = true;
    for (let j = 0; j < m.length; j++) {
      if (tokens[i + j] !== m[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return { match: true, index: i };
  }
  return { match: false };
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
