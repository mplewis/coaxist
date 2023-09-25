import z from "zod";
import { QUALITY_RANKING, Quality } from "../data/quality";
import { TAGS, Tag } from "../data/tag";

const SUPPORTED_SORTS = ["mostSeeders", "largestFileSize"] as const;
export type SupportedSort = (typeof SUPPORTED_SORTS)[number];

const MINMAX_SCHEMA = z
  .object({
    quality: z.enum(QUALITY_RANKING).optional(),
    seeders: z.number().positive().optional(),
  })
  .optional();
export const PROFILE_SCHEMA = z.object({
  name: z.string(),
  sort: z.enum(SUPPORTED_SORTS).optional().default("mostSeeders"),
  minimum: MINMAX_SCHEMA,
  maximum: MINMAX_SCHEMA,
  required: z.array(z.enum(TAGS)).optional(),
  preferred: z.array(z.enum(TAGS)).optional(),
  discouraged: z.array(z.enum(TAGS)).optional(),
  forbidden: z.array(z.enum(TAGS)).optional(),
});
export type Profile = z.infer<typeof PROFILE_SCHEMA>;

export const DEFAULT_PROFILES: z.input<typeof PROFILE_SCHEMA>[] = [
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

export function satisfiesQuality(
  q: { minimum?: { quality?: Quality }; maximum?: { quality?: Quality } },
  item: { quality: Quality }
): boolean {
  if (q.minimum?.quality) {
    if (
      QUALITY_RANKING.indexOf(item.quality) >
      QUALITY_RANKING.indexOf(q.minimum.quality)
    ) {
      return false;
    }
  }
  if (q.maximum?.quality) {
    if (
      QUALITY_RANKING.indexOf(item.quality) <
      QUALITY_RANKING.indexOf(q.maximum.quality)
    ) {
      return false;
    }
  }
  return true;
}

export function satisfiesTags(
  q: Pick<Profile, "required" | "forbidden">,
  item: { tags: Tag[] }
): boolean {
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

export function satisfies(
  profile: Profile,
  item: { quality: Quality; tags: Tag[] }
): boolean {
  return satisfiesQuality(profile, item) && satisfiesTags(profile, item);
}

export function isPreferred(
  profile: Profile,
  item: { quality: Quality; tags: Tag[] }
): boolean {
  for (const tag of profile.discouraged ?? []) {
    if (item.tags.includes(tag)) return false;
  }
  return true;
}
