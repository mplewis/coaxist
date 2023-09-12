/** A specification for a tag and the token search criteria which it matches. */
export type TokenMatcher = {
  /** The value this token matcher generates upon match */
  name: string;
  /** One or more expressions that match tokens to generate a tag */
  match: MatcherCriteria;
  /** If true, this expression consumes the tokens it matches.
   * Future expressions will not find them in the stream. */
  consume?: boolean;
};
/** One or more expressions that match tokens in order to generate a tag. */
export type MatcherCriteria = readonly (string | readonly string[])[];
