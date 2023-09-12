import { Classification, QUALITY_RANKING, Quality, Tag } from "./classify";

export type Profile = {
  name: string;
  minimum?: { quality: Quality };
  maximum?: { quality: Quality };
  required?: Tag[];
  discouraged?: Tag[];
  forbidden?: Tag[];
};

// demo
export const myProfiles: Profile[] = [
  {
    name: "Best Available",
    discouraged: ["remux"],
  },
  {
    name: "Accessible",
    maximum: { quality: "1080p" },
    forbidden: ["remux", "hdr"],
  },
];

export function satisfiesQuality(
  q: Pick<Profile, "minimum" | "maximum">,
  item: Pick<Classification, "quality">
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
  item: Pick<Classification, "tags">
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

export function satisfies(profile: Profile, item: Classification): boolean {
  return satisfiesQuality(profile, item) && satisfiesTags(profile, item);
}

// TODO: Order options by preference
