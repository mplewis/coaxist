import { describe, expect, it } from "vitest";
import { Spec, sort } from "./engine";

describe("sort", () => {
  it("sorts as expected", () => {
    const rarityOrder = ["legendary", "rare", "normal"];
    type Rarity = (typeof rarityOrder)[number];
    type Pokemon = { name: string; tier: Rarity; power: number };
    const spec: Spec<Pokemon> = {
      eligible: (p) => rarityOrder.includes(p.tier),
      tier: (p) => rarityOrder.indexOf(p.tier),
      compare: (a, b) => b.power - a.power,
    };

    const items: Pokemon[] = [
      { name: "Pidgey", tier: "normal", power: 10 },
      { name: "Pikachu", tier: "normal", power: 30 },
      { name: "Kakuna", tier: "joke", power: 3 },
      { name: "Blastoise", tier: "rare", power: 90 },
      { name: "Rayquaza", tier: "legendary", power: 80 },
      { name: "Dragonite", tier: "rare", power: 100 },
      { name: "Mew", tier: "legendary", power: 100 },
      { name: "Unown", tier: "rare", power: 20 },
    ];

    expect(sort(spec, items)).toEqual([
      { tier: "legendary", power: 100, name: "Mew" },
      { tier: "legendary", power: 80, name: "Rayquaza" },
      { tier: "rare", power: 100, name: "Dragonite" },
      { tier: "rare", power: 90, name: "Blastoise" },
      { tier: "rare", power: 20, name: "Unown" },
      { tier: "normal", power: 30, name: "Pikachu" },
      { tier: "normal", power: 10, name: "Pidgey" },
    ]);
  });
});
