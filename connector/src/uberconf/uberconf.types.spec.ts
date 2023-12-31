import { describe, expect, it } from "vitest";

import { positiveDuration } from "./uberconf.types";

describe("postiiveDuration", () => {
  it("validates as expected", () => {
    expect(positiveDuration.safeParse("1s")).toEqual({
      success: true,
      data: 1000,
    });
    expect(positiveDuration.safeParse("1m")).toEqual({
      success: true,
      data: 60000,
    });
    const result1 = positiveDuration.safeParse("lsdkfjsldkjf");
    if (result1.success) throw new Error("expected success");
    expect(result1.error.issues[0].message).toContain(
      "Must be a positive duration string"
    );
    const result3 = positiveDuration.safeParse("-4m");
    if (result3.success) throw new Error("expected success");
    expect(result3.error.issues[0].message).toContain(
      "Must be a positive duration string"
    );
  });
});
