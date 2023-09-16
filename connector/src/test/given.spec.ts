import { describe, expect, it } from "vitest";
import { Given } from "./given";

const { given, v } = new Given();

describe("given demo", () => {
  given("a", () => 1);
  given("b", () => 2);

  it("sets values as expected", () => {
    expect(v.a + v.b).toEqual(3);
  });

  describe("when updating a value", () => {
    given("a", () => 3);

    it("updates the value", () => {
      expect(v.a + v.b).toEqual(5);
    });

    describe("when updating it again", () => {
      given("a", () => 6);

      it("updates the value again", () => {
        expect(v.a + v.b).toEqual(8);
      });
    });

    it("respects the original value", () => {
      expect(v.a + v.b).toEqual(5);
    });
  });
});
