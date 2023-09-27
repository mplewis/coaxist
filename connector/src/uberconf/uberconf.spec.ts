import { describe, expect, it } from "vitest";
import { buildRcloneConf } from "./uberconf";
import { DebridConfig } from "./uberconf.types";

describe("buildRcloneConf", () => {
  it("builds the expected ini data", () => {
    const config: DebridConfig = {
      realDebrid: { username: "foo", password: "bar", apiKey: "baz" },
    };
    expect(buildRcloneConf(config)).toMatchInlineSnapshot(`
      "[provider]
      type = webdav
      vendor = other
      url = https://dav.real-debrid.com/
      user = foo
      pass = bar
      "
    `);
  });
});
