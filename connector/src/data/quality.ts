import { TokenMatcher } from "../logic/classify.types";

/** Matchers for all known qualities. */
export const QUALITY_MATCHERS = [
  { name: "2160p", match: ["2160p", "4k"] },
  { name: "1080p", match: ["1080p", "fullhd", "fhd"] },
  { name: "720p", match: ["720p"] },
  { name: "576p", match: ["576p", "pal"] },
  { name: "480p", match: ["480p", "ntsc", "sd"] },
] as const satisfies readonly TokenMatcher[];
/** All known qualities, ordered in descending order. */
export const QUALITY_RANKING = QUALITY_MATCHERS.map((m) => m.name);
/** Represents the quality of the media in a torrent. */
export type Quality = (typeof QUALITY_MATCHERS)[number]["name"];

/** Q1 was higher quality than Q2. */
export const Q1_HIGHER = -1;
/** Q2 was higher quality than Q1. */
export const Q2_HIGHER = 1;
/** Q1 and Q2 were the same quality. */
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
