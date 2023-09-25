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
export const QUALITY_RANKING = QUALITY_MATCHERS.map((m) => m.name) as [
  Quality,
  ...Quality[],
];
/** Represents the quality of the media in a torrent. */
export type Quality = (typeof QUALITY_MATCHERS)[number]["name"];

/** A compare function for qualities, highest quality first. */
export function compareQuality(a: Quality, b: Quality): number {
  const qrA = QUALITY_RANKING.indexOf(a);
  const qrB = QUALITY_RANKING.indexOf(b);
  return qrA - qrB;
}
