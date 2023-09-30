import { QUALITY_RANKING, Quality, compareQuality } from "../data/quality";
import { Tag } from "../data/tag";
import { SortSpec, sort } from "./sort/engine";
import { Profile } from "../data/profile";
import log from "../log";

/** What grouping of media is contained within this torrent? */
export type ContainedMediaType = "movie" | "season" | "episode";

export type Candidate = {
  mediaType: ContainedMediaType;
  quality: Quality;
  tags: Tag[];
  seeders: number;
  bytes: number;
};

export function satisfiesQuality(profile: Profile, item: Candidate): boolean {
  if (profile.minimum?.quality) {
    if (
      QUALITY_RANKING.indexOf(item.quality) >
      QUALITY_RANKING.indexOf(profile.minimum.quality)
    ) {
      log.debug(
        { item, profile },
        "item is too low quality, marking as ineligible"
      );
      return false;
    }
  }
  if (profile.maximum?.quality) {
    if (
      QUALITY_RANKING.indexOf(item.quality) <
      QUALITY_RANKING.indexOf(profile.maximum.quality)
    ) {
      log.debug(
        { item, profile },
        "item is too high quality, marking as ineligible"
      );
      return false;
    }
  }
  return true;
}

export function satisfiesSeeders(profile: Profile, item: Candidate): boolean {
  if (profile.minimum?.seeders && item.seeders < profile.minimum.seeders) {
    log.debug(
      { item, profile },
      "item has too few seeders, marking as ineligible"
    );
    return false;
  }
  if (profile.maximum?.seeders && item.seeders > profile.maximum.seeders) {
    log.debug(
      { item, profile },
      "item has too many seeders, marking as ineligible"
    );
    return false;
  }
  return true;
}

export function satisfiesTags(q: Profile, item: Candidate): boolean {
  if (q.required) {
    for (const tag of q.required ?? []) {
      if (!item.tags.includes(tag)) {
        log.debug(
          { item, profile: q, tag },
          "item missing required tag, marking as ineligible"
        );
        return false;
      }
    }
  }
  if (q.forbidden) {
    for (const tag of q.forbidden ?? []) {
      if (item.tags.includes(tag)) {
        log.debug(
          { item, profile: q, tag },
          "item has forbidden tag, marking as ineligible"
        );
        return false;
      }
    }
  }
  return true;
}

export function satisfies(profile: Profile, item: Candidate): boolean {
  return (
    satisfiesQuality(profile, item) &&
    satisfiesSeeders(profile, item) &&
    satisfiesTags(profile, item)
  );
}

function selectEligible(
  desired: ContainedMediaType,
  profile: Profile,
  c: Candidate
) {
  if (c.mediaType !== desired) {
    log.debug(
      { desired, item: c },
      "item is not the desired media type, marking as ineligible"
    );
    return false;
  }
  if (!satisfies(profile, c)) {
    log.debug(
      { item: c, profile },
      "item does not satisfy profile, marking as ineligible"
    );
    return false;
  }
  return true;
}

function tierByPreferredDiscouraged(profile: Profile, c: Candidate) {
  if (profile.discouraged) {
    const count = profile.discouraged.filter((t) => c.tags.includes(t)).length;
    if (count > 0) return count;
  }
  if (profile.preferred) {
    const count = profile.preferred.filter((t) => c.tags.includes(t)).length;
    if (count > 0) return -count;
  }
  return 0;
}

function sortByQualityThenProfileSortCriteria(
  profile: Profile,
  a: Candidate,
  b: Candidate
): number {
  const cq = compareQuality(a.quality, b.quality);
  if (cq !== 0) return cq;

  switch (profile.sort) {
    case "mostSeeders":
      return b.seeders - a.seeders;
    case "largestFileSize":
      return b.bytes - a.bytes;
    default:
      return profile.sort satisfies never;
  }
}

/**
 * Sort a list of candidates by a profile's criteria.
 * @returns all eligible candidates, best matches first
 */
export function sortCandidates<T extends Candidate>(
  type: ContainedMediaType,
  profile: Profile,
  candidates: T[]
): T[] {
  const spec: SortSpec<Candidate> = {
    eligible: (c) => selectEligible(type, profile, c),
    tier: (c) => tierByPreferredDiscouraged(profile, c),
    compare: (a, b) => sortByQualityThenProfileSortCriteria(profile, a, b),
  };
  return sort(spec, candidates);
}

/**
 * Pick the best candidate for a profile from a list of torrents.
 * @returns the best candidate, or null if none are eligible
 */
export function pickBest<T extends Candidate>(
  type: ContainedMediaType,
  profile: Profile,
  candidates: T[]
): T | null {
  const sorted = sortCandidates(type, profile, candidates);
  if (!sorted.length) {
    log.debug(
      { type, profile, count: candidates.length },
      "no eligible candidates"
    );
    return null;
  }
  return sorted[0];
}
