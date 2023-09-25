export interface Spec<T> {
  eligible: (a: T) => boolean;
  tier: (a: T) => number;
  compare: (a: T, b: T) => number;
}

export function sort<T>(spec: Spec<T>, items: T[]): T[] {
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

export function best<T>(spec: Spec<T>, items: T[]): T | undefined {
  return sort(spec, items)[0];
}
