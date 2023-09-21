import { describe, expect, it } from "vitest";
import { buildDebridPathPart } from "./debrid";

describe("buildDebridPathPart", () => {
  it("builds the expected path part", () => {
    expect(
      buildDebridPathPart({
        allDebridAPIKey: "some-ad-api-key",
        realDebridAPIKey: "some-rd-api-key",
        putio: {
          clientID: "some-putio-client-id",
          token: "some-putio-token",
        },
      })
    ).toMatchInlineSnapshot('"alldebrid=some-ad-api-key|putio=some-putio-client-id@some-putio-token|realdebrid=some-rd-api-key"');
  });
});
