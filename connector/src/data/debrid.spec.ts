import { describe, expect, it } from "vitest";

import { buildDebridPathPart } from "./debrid";

describe("buildDebridPathPart", () => {
  it("builds the expected path part", () => {
    expect(
      buildDebridPathPart({ provider: "alldebrid", apiKey: "some-api-key" })
    ).toEqual("alldebrid=some-api-key");
  });
});
