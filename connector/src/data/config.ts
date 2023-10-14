import { readFileSync } from "fs";

import z from "zod";

import log from "../log";
import { loadOrInitUberConf } from "../uberconf/uberconf";
import { secureHash } from "../util/hash";

import { toDebridCreds } from "./debrid";

const ENV_CONF_SCHEMA = z.intersection(
  z.object({
    /** Location of the config.yaml which holds the UberConf data */
    UBERCONF_PATH: z.string(),
    /** Directory where Connector will store all of its state */
    STORAGE_DIR: z.string(),
    /** Location of the Overseerr server */
    OVERSEERR_HOST: z.string().default("http://localhost:5055"),
  }),
  z.union([
    z.object({ OVERSEERR_CONFIG_PATH: z.string() }),
    z.object({ OVERSEERR_API_KEY: z.string() }),
  ])
);

/** Get the Overseerr API key from its config file. */
function getOverseerrAPIKey(path: string): string {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  return data.main.apiKey;
}

/** Load the required config values from the environment. */
export function loadConfig(env = process.env) {
  const envConf = ENV_CONF_SCHEMA.parse(env);
  const uberConf = loadOrInitUberConf(envConf.UBERCONF_PATH);
  const overseerrAPIKey = (() => {
    if ("OVERSEERR_API_KEY" in envConf) return envConf.OVERSEERR_API_KEY;
    return getOverseerrAPIKey(envConf.OVERSEERR_CONFIG_PATH);
  })();

  const debridCreds = toDebridCreds(uberConf.debrid);
  const debridCredsHash = secureHash(debridCreds);

  const config = {
    envConf,
    uberConf,
    overseerrAPIKey,
    debridCreds,
    debridCredsHash,
  };
  log.debug({ config }, "loaded config");
  return config;
}
