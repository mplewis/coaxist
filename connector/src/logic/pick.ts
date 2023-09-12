import * as R from "remeda";
import { QUALITY_RANKING, Quality } from "./classify";
import { Profile, isPreferred, satisfies } from "./profile";
import { TorrentInfo } from "./parse";

function groupByQualityDesc<T extends { quality: Quality }>(cands: T[]): T[][] {
  const lookup: Record<Quality, T[]> = R.groupBy(cands, (c) => c.quality);
  return QUALITY_RANKING.map((q) => lookup[q] ?? []);
}

export function pickBest(
  profile: Profile,
  candidates: TorrentInfo[]
): TorrentInfo | null {
  const acceptable = candidates.filter((c) => satisfies(profile, c));
  if (acceptable.length === 0) return null;

  const [preferred, fallback] = R.partition(acceptable, (c) =>
    isPreferred(profile, c)
  );
  const groups = [
    ...groupByQualityDesc(preferred),
    ...groupByQualityDesc(fallback),
  ].filter((g) => g.length > 0);
  const bestGroup = groups[0];
  return R.maxBy(bestGroup, (c) => c.seeders) ?? null;
}
