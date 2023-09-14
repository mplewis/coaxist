import { readFileSync, statSync, writeFileSync } from "fs";
import { log } from "../server";

const keys = [
  "ALLDEBRID_API_KEY",
  "OVERSEERR_API_KEY",
  "OVERSEERR_HOST",
] as const;
export type Config = Record<(typeof keys)[number], string>;

const placeholderRx = /<YOUR_\w+_HERE>/g;

let cachedConfig: Config | null = null;

function exist(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function getConfig(): Config {
  if (!cachedConfig) {
    const path = process.env.CONFIG || "config.env";

    if (!exist(path)) {
      const tmpl = keys.map((k) => `${k}=<YOUR_${k}_HERE>`).join("\n");
      writeFileSync(path, tmpl);
      log.warn(
        { path },
        "Wrote a new config file. Please edit it and fill in your values."
      );
    }

    const config = {} as Config;
    const raw = readFileSync(path, "utf-8");
    const parsed = raw.split("\n").reduce(
      (acc, line) => {
        const [key, ...val] = line.split("=");
        if (key && val) acc[key] = val.join("=");
        return acc;
      },
      {} as Record<string, string>
    );
    for (const key of keys) {
      const val = parsed[key];
      if (!val)
        throw new Error(`Config file at ${path}: Missing value for ${key}`);
      if (val.match(placeholderRx))
        throw new Error(
          `Config file at ${path}: Placeholder present for ${key}; please fill this value in`
        );
      config[key] = val;
    }
    cachedConfig = config;
  }
  return cachedConfig;
}
