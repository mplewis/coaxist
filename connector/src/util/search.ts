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
