import { readFileSync, statSync, writeFileSync } from "fs";

const keys = ["OVERSEERR_API_KEY", "OVERSEERR_HOST"] as const;
export type Config = Record<(typeof keys)[number], string>;

const placeholderRx = /<YOUR_\w+_HERE>/g;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    const path = process.env.CONFIG || "config.env";
    let exist = false;
    try {
      exist = statSync(path).isFile();
    } catch {}

    if (!exist) {
      const tmpl = keys.map((k) => `${k}=<YOUR_${k}_HERE>`).join("\n");
      writeFileSync(path, tmpl);
      console.log(
        `Wrote a new config file to ${path}. Please edit it and fill in your values.`
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
    _config = config;
  }
  return _config;
}
