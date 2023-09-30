import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { buildRcloneConf } from "./uberconf";
import { DebridConfig, UBERCONF_SCHEMA } from "./uberconf.types";

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

describe("schema", () => {
  it("parses the example file successfully", () => {
    const raw = readFileSync(join(__dirname, "default.yaml"), "utf8");
    const data = yaml.load(raw);
    const result = UBERCONF_SCHEMA.safeParse(data);
    expect(result.success).toBe(true);
  });
});
