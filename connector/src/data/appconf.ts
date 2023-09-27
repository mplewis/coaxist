import { readFileSync } from "fs";
import z from "zod";
import yaml from "js-yaml";
import { join } from "path";

const OVERSEERR_CONF_SCHEMA = z.union([
  z.object({ overseerrAPIKey: z.string() }),
  z.object({ overseerrConfigFile: z.string() }),
]);

export const APPCONF_SCHEMA = z.intersection(
  OVERSEERR_CONF_SCHEMA,
  z.object({ databaseURL: z.string() })
);
export type AppConf = z.infer<typeof APPCONF_SCHEMA>;

export function parseConfig(storageDir: string): AppConf {
  const path = join(storageDir, "config.yaml");
  const raw = readFileSync(path, "utf-8");
  const data = yaml.load(raw);
  return APPCONF_SCHEMA.parse(data);
}
