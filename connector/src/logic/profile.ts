import z from "zod";
import { QUALITY_RANKING, Quality, compareQuality } from "../data/quality";
import { TAGS, Tag } from "../data/tag";
import { SortSpec, sort } from "./sort/engine";

/** What grouping of media is contained within this torrent? */
export type ContainedMediaType = "movie" | "season" | "episode";

const SUPPORTED_SORTS = ["mostSeeders", "largestFileSize"] as const;
export type SupportedSort = (typeof SUPPORTED_SORTS)[number];
const DEFAULT_SORT = "largestFileSize";

export type Candidate = {
  mediaType: ContainedMediaType;
  quality: Quality;
  tags: Tag[];
  seeders: number;
  bytes: number;
};

const MINMAX_SCHEMA = z
  .object({
    quality: z.enum(QUALITY_RANKING).optional(),
    seeders: z.number().positive().optional(),
  })
  .optional();
export const PROFILE_SCHEMA = z.object({
  name: z.string(),
  sort: z.enum(SUPPORTED_SORTS).optional().default(DEFAULT_SORT),
  minimum: MINMAX_SCHEMA,
  maximum: MINMAX_SCHEMA,
  required: z.array(z.enum(TAGS)).optional(),
  preferred: z.array(z.enum(TAGS)).optional(),
  discouraged: z.array(z.enum(TAGS)).optional(),
  forbidden: z.array(z.enum(TAGS)).optional(),
});
export type Profile = z.infer<typeof PROFILE_SCHEMA>;
export type ProfileInput = z.input<typeof PROFILE_SCHEMA>;

export const DEFAULT_PROFILES: ProfileInput[] = [
  {
    name: "(example) Most Compatible",
    maximum: { quality: "1080p" },
    discouraged: ["hdr"],
    forbidden: ["dolbyvision", "h265"],
  },
  {
    name: "(example) Remux Only",
    required: ["remux"],
  },
  {
    name: "(example) High Definition",
    minimum: { quality: "720p" },
    forbidden: ["cam"],
  },
];

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
