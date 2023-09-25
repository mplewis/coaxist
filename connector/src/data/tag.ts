import { MatcherCriteria, TokenMatcher } from "../logic/classify.types";

const brremux: MatcherCriteria = ["bdremux", "brremux"];
const dolbyvision: MatcherCriteria = ["dv", ["dolby", "vision"]];
const hdr10: MatcherCriteria = ["hdr10"];
const hdr10plus: MatcherCriteria = ["hdr10plus", ["hdr10", "plus"], "hdr10+"];
const hdr: MatcherCriteria = [
  ...hdr10,
  ...hdr10plus,
  ...dolbyvision,
  "hdr",
  "10bit",
];

/** Matchers for all known tags. */
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
type TagMatcherTags = (typeof TAG_MATCHERS)[number]["name"];

/** Represents a known fact about the media in a torrent. */
export type Tag = TagMatcherTags | "cached"; // TODO
/** All known tags. */
export const TAGS = TAG_MATCHERS.map((m) => m.name) as [Tag, ...Tag[]];
