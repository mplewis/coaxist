const QUALITY_RANKING = ["2160p", "1080p", "720p", "576p", "480p"];

export type Quality = (typeof QUALITY_RANKING)[number];

type TagConsumer = {
  tag: string;
  match: readonly (string | readonly string[])[];
  consume?: boolean;
};

const dv: TagConsumer["match"] = ["dv", ["dolby", "vision"]];

const TAG_CONSUMERS = [
  { tag: "bluray", match: ["bluray", "bdrip", "bdremux", "brremux"] },
  { tag: "dv", match: dv },
  { tag: "hdr", match: ["hdr", "hdr10", ...dv] },
  { tag: "hdtv", match: ["hdtv"] },
  { tag: "remux", match: ["remux"] },
  { tag: "web", match: ["web", "webdl", "webrip"] },
  { tag: "cam", match: ["cam", "camrip", "ts", "telesync", "telecine"] },
  { tag: "multisub", match: [["multi", "sub"]], consume: true },
  { tag: "dualaudio", match: ["dual"] },
  { tag: "multiaudio", match: ["multi"] },
] as const satisfies readonly TagConsumer[];

export type Tag = (typeof TAG_CONSUMERS)[number]["tag"];

const splitter = /[\s.]+/;

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

export function parseTags(s: string): Tag[] {
  let tokens = s.toLowerCase().replace("-", "").split(splitter);
  const tags = new Set<Tag>();

  for (const consumer of TAG_CONSUMERS) {
    const { tag, match: matchers } = consumer;
    const consume = "consume" in consumer ? consumer.consume : false;

    for (const matcher of matchers) {
      const result = findSlidingWindowMatch(tokens, matcher);
      if (result.match) {
        tags.add(tag);
        if (consume) {
          tokens = [
            ...tokens.slice(0, result.index),
            ...tokens.slice(result.index + matcher.length),
          ];
        }
        break;
      }
    }
  }

  return [...tags].sort();
}
