import { QUALITY_RANKING, Quality } from "../data/quality";
import { Tag } from "../data/tag";

export type Profile = {
  name: string;
  minimum?: { quality: Quality };
  maximum?: { quality: Quality };
  required?: Tag[];
  discouraged?: Tag[];
  forbidden?: Tag[];
};

export function satisfiesQuality(
  q: { minimum?: { quality: Quality }; maximum?: { quality: Quality } },
  item: { quality: Quality }
): boolean {
  if (q.minimum) {
    if (
      QUALITY_RANKING.indexOf(item.quality) >
      QUALITY_RANKING.indexOf(q.minimum.quality)
    ) {
      return false;
    }
  }
  if (q.maximum) {
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
