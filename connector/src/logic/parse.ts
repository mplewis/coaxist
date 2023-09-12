import { findSlidingWindowMatch } from "../util/search";
import { TokenMatcher } from "./classify.types";

const TOKEN_SPLITTER = /[\s.]+/;
const GROUP_SUFFIX_MATCHER = /([^-]+)-(.+)$/; // x265-SomeGroup -> x265
const VIDEO_EXTENSIONS = ["mkv", "mp4", "avi", "wmv", "mov", "flv", "webm"];

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
