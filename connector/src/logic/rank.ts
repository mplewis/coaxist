import { QUALITY_RANKING, Quality, compareQuality } from "../data/quality";
import { Tag } from "../data/tag";
import { SortSpec, sort } from "./sort/engine";
import { Profile } from "../data/profile";

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
      return false;
    }
  }
  if (profile.maximum?.quality) {
    if (
      QUALITY_RANKING.indexOf(item.quality) <
      QUALITY_RANKING.indexOf(profile.maximum.quality)
    ) {
      return false;
    }
  }
  return true;
}

export function satisfiesSeeders(profile: Profile, item: Candidate): boolean {
  if (profile.minimum?.seeders && item.seeders < profile.minimum.seeders)
    return false;
  if (profile.maximum?.seeders && item.seeders > profile.maximum.seeders)
    return false;
  return true;
}

export function satisfiesTags(q: Profile, item: Candidate): boolean {
  if (q.required) {
    for (const tag of q.required ?? []) {
      if (!item.tags.includes(tag)) return false;
    }
  }
  if (q.forbidden) {
    for (const tag of q.forbidden ?? []) {
      if (item.tags.includes(tag)) return false;
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
  if (c.mediaType !== desired) return false;
  if (!satisfies(profile, c)) return false;
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
  return sorted[0] ?? null;
}
