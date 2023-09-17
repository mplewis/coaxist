import { readFileSync, statSync, writeFileSync } from "fs";
import z from "zod";
import { mkdir } from "fs/promises";
import { join } from "path";
import { exit } from "process";
import { isTruthy } from "remeda";
import log from "../log";
import packageJSON from "../../package.json";

export const { version: VERSION } = packageJSON;

const storageDir = process.env.STORAGE_DIR || "/config/connector";

const CONFIG_SCHEMA = z.object({
  ALLDEBRID_API_KEY: z.string(),
  DATABASE_URI: z.string(),
  OVERSEERR_API_KEY: z.string(),
  OVERSEERR_HOST: z.string().url(),
});
const CONFIG_DEFAULTS: Partial<Config> = {
  DATABASE_URI: `file:${join(storageDir, "db.sqlite")}`,
  OVERSEERR_HOST: "http://localhost:5055",
};
export type Config = z.infer<typeof CONFIG_SCHEMA>;

let cachedConfig: Config | null = null;

function exist(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export async function getConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;

  const keys = Object.keys(CONFIG_SCHEMA.shape) as (keyof Config)[];

  await mkdir(storageDir, { recursive: true });
  const path = join(storageDir, "config.env");
  if (!exist(path)) {
    const tmpl = keys
      .map((k) =>
        CONFIG_DEFAULTS[k]
          ? `${k}=${CONFIG_DEFAULTS[k]}`
          : `${k}=<YOUR_${k}_HERE>`
      )
      .join("\n");
    writeFileSync(path, tmpl);
    log.warn(
      { path },
      "Wrote a new config file. Please edit it and fill in your values."
    );
  }

  const raw = readFileSync(path, "utf-8");
  const rawKV = raw.split("\n").reduce(
    (acc, line) => {
      const [key, ...val] = line.split("=");
      if (key && val) acc[key] = val.join("=");
      return acc;
    },
    {} as Record<string, string>
  );
  const parsed = CONFIG_SCHEMA.safeParse(rawKV);
  if (!parsed.success) {
    log.error({ path, errors: parsed.error }, "Error parsing config file");
    exit(1);
  }

  const placeholders = Object.entries(parsed.data)
    .map(([key, val]) => (val.match(/<YOUR_\w+_HERE>/g) ? key : null))
    .filter(isTruthy);
  if (placeholders.length > 0) {
    log.error(
      { path, keys: placeholders },
      "Placeholders present in config file: please fill these values in"
    );
    exit(1);
  }

  cachedConfig = parsed.data;
  const sanitized = Object.entries(cachedConfig).reduce(
    (acc, [key, val]) => {
      acc[key] = key.includes("API_KEY") ? "<redacted>" : val;
      return acc;
    },
    {} as Record<string, string>
  );
  log.info({ config: sanitized }, "Loaded config");
  return cachedConfig;
}
