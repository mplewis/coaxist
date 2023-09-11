import { Classification, QUALITY_RANKING, Quality } from "./classify";

export type Criteria = {
  quality: Quality[];
  tags: Tag[];
};

export type Profile = {
  name: string;
  minimum?: { quality: Quality };
  maximum?: { quality: Quality };
  required?: Partial<Criteria>;
  discouraged?: Partial<Criteria>;
  forbidden?: Partial<Criteria>;
};

// demo
export const myProfiles: Profile[] = [
  {
    name: "Best Available",
    discouraged: { tags: ["remux"] },
  },
  {
    name: "Accessible",
    maximum: { quality: "1080p" },
    forbidden: { tags: ["remux", "hdr"] },
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
