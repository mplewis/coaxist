/** A specification for sorting items. */
export interface SortSpec<T> {
  /** True if this item is eligible, false to remove it from results */
  eligible: (a: T) => boolean;
  /** The numbered tier into which this result should be sorted - lower number is higher priority */
  tier: (a: T) => number;
  /** A compare function to sort items within tiers - +1 = a > b */
  compare: (a: T, b: T) => number;
}

/** Sort items in tiers using the given specification. */
export function sort<T>(spec: SortSpec<T>, items: T[]): T[] {
  const eligible = items.filter(spec.eligible);
  const tiers = eligible.reduce((acc, item) => {
    const tier = spec.tier(item);
    if (!acc.has(tier)) acc.set(tier, []);
    acc.get(tier)!.push(item);
    return acc;
  }, new Map<number, T[]>());
  const sortedTiers = [...tiers.keys()].sort((a, b) => a - b);
  const sortedItems = sortedTiers.flatMap((tier) =>
    tiers.get(tier)!.sort(spec.compare)
  );
  return sortedItems;
}
