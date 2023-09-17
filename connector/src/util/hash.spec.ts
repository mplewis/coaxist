import { describe, expect } from "vitest";
import { it } from "node:test";
import { secureHash } from "./hash";

describe("secureHash", () => {
  it("hashes objects stably", () => {
    expect(secureHash({ a: 1, b: 2 })).toEqual(secureHash({ b: 2, a: 1 }));
  });
});
