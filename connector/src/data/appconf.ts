import { readFileSync } from "fs";
import z from "zod";
import yaml from "js-yaml";
import { join } from "path";
import { UberConf } from "../uberconf/uberconf.types";
import { parseConfig as parseUberconf } from "../uberconf/uberconf";

export const APPCONF_PARAMS_SCHEMA = z.intersection(
  z.object({ databaseURL: z.string(), storageDir: z.string() }),
  z.union([
    z.object({ overseerrAPIKey: z.string() }),
    z.object({ overseerrConfigFile: z.string() }),
  ])
);
export type AppConf = z.infer<typeof APPCONF_PARAMS_SCHEMA>;

export type AppConfHydrated = {
  overseerrAPIKey: string;
  databaseURL: string;
  storageDir: string;
  uberconf: UberConf;
};

function getOverseerrAPIKey(path: string): string {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  return data.main.apiKey;
}

export function parseConfig(
  uberconfPath: string,
  storageDir?: string
): AppConfHydrated {
  const data = (() => {
    if (storageDir) {
      const path = join(storageDir, "config.yaml");
      const raw = readFileSync(path, "utf-8");
      const d = yaml.load(raw);
      return APPCONF_PARAMS_SCHEMA.parse(d);
    }

    return APPCONF_PARAMS_SCHEMA.parse({
      overseerrAPIKey: process.env.OVERSEERR_API_KEY,
      overseerrConfigFile: process.env.OVERSEERR_CONFIG_FILE,
      databaseURL: process.env.DATABASE_URL,
      storageDir: process.env.STORAGE_DIR,
    });
  })();

  const uberconf = parseUberconf(uberconfPath);
  const overseerrAPIKey =
    "overseerrAPIKey" in data
      ? data.overseerrAPIKey
      : getOverseerrAPIKey(data.overseerrConfigFile);

  return {
    uberconf,
    overseerrAPIKey,
    databaseURL: data.databaseURL,
    storageDir: data.storageDir,
  };
}
