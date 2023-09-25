import yaml from "js-yaml";
import z from "zod";
// import { mkdir, readFile, writeFile } from "fs/promises";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { exit } from "process";
import log from "../log";
import packageJSON from "../../package.json";
import { DEFAULT_PROFILES, PROFILE_SCHEMA, Profile } from "../data/profile";
import { DebridCreds, parseDebridCreds } from "../data/debrid";

export const { version: VERSION } = packageJSON;

const STORAGE_DIR = process.env.STORAGE_DIR || "/config/connector";

const YAML_TEMPLATE_SENTINEL = (name: string) =>
  `# This is an example ${name}. Please fill in your values, then delete this line.`;

// TODO: Custom validators for time strings
const CONFIG_SCHEMA = z.object({
  /** The connection string for SQLite, e.g. `file:/path/to/your/db.sqlite` */
  DATABASE_URL: z.string(),

  /** The API key for Overseerr */
  OVERSEERR_API_KEY: z.string(),
  /** The URL for the Overseerr installation hosting requests */
  OVERSEERR_HOST: z.string().url(),
  /** How often we check for new Overseerr requests and Plex watchlist items. */
  OVERSEERR_POLL_INTERVAL: z.string(),
  /** How many jobs for outstanding Overseerr requests we should work on at once */
  OVERSEERR_REQUEST_CONCURRENCY: z.number().int().positive(),

  /** Generate an AllDebrid API key at https://alldebrid.com/apikeys/ */
  ALLDEBRID_API_KEY: z.string().optional(),
  /** TODO */
  DEBRIDLINK_API_KEY: z.string().optional(),
  /** TODO */
  OFFCLOUD_API_KEY: z.string().optional(),
  /** TODO */
  PREMIUMIZE_API_KEY: z.string().optional(),
  /** TODO */
  PUTIO_CLIENT_ID: z.string().optional(),
  /** TODO */
  PUTIO_TOKEN: z.string().optional(),
  /** Get your Real-Debrid API key at https://real-debrid.com/apitoken */
  REALDEBRID_API_KEY: z.string().optional(),

  /** Ask the Debrid service to refresh a file this many days before it expires */
  REFRESH_WITHIN_EXPIRY: z.string(),
  /** How long before the Debrid service removes a file from the drive */
  SNATCH_EXPIRY: z.string(),
  /** How often we check for stale snatches that need to be refreshed */
  SNATCH_REFRESH_CHECK_INTERVAL: z.string(),

  /** How often we search for torrents for outstanding media, even if no new Overseerr requests have arrived */
  TORRENT_SEARCH_INTERVAL: z.string(),
  /** How far before the official release date we should start searching for a piece of media */
  SEARCH_BEFORE_RELEASE_DATE: z.string(),
  /** How many outstanding Torrentio requests we should work on at once */
  TORRENTIO_REQUEST_CONCURRENCY: z.number().int().positive(),
});

const CONFIG_DEFAULTS: Config = {
  DATABASE_URL: `file:${join(STORAGE_DIR, "db.sqlite")}`,

  OVERSEERR_API_KEY: "<your API key goes here>",
  OVERSEERR_HOST: "http://localhost:5055",
  OVERSEERR_POLL_INTERVAL: "15s",
  OVERSEERR_REQUEST_CONCURRENCY: 5,

  // TODO: fail parse on placeholder values
  ALLDEBRID_API_KEY: "<your AllDebrid API key goes here>",
  DEBRIDLINK_API_KEY: "<your Debrid-Link API key goes here>",
  OFFCLOUD_API_KEY: "<your Offcloud API key goes here>",
  PREMIUMIZE_API_KEY: "<your Premiumize API key goes here>",
  PUTIO_CLIENT_ID: "<your Put.io client ID goes here>",
  PUTIO_TOKEN: "<your Put.io token goes here>",
  REALDEBRID_API_KEY: "<your Real-Debrid API key goes here>",

  REFRESH_WITHIN_EXPIRY: "2d",
  SNATCH_EXPIRY: "14d",
  SNATCH_REFRESH_CHECK_INTERVAL: "1h",

  TORRENT_SEARCH_INTERVAL: "1h",
  SEARCH_BEFORE_RELEASE_DATE: "7d",
  TORRENTIO_REQUEST_CONCURRENCY: 5,
};

/** Core app config which includes API keys. */
export type Config = z.infer<typeof CONFIG_SCHEMA>;

type Validator<T> = (x: any) =>
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: any;
    };

const cache: Record<string, unknown> = {};

export function setForTestsOnly(k: string, v: unknown) {
  cache[k] = v;
}

export function unsetForTestsOnly(k: string) {
  delete cache[k];
}

function exist(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function initFile(a: { filename: string; desc: string; template: any }) {
  const { filename, desc, template } = a;
  const sentinel = YAML_TEMPLATE_SENTINEL(desc);

  mkdirSync(STORAGE_DIR, { recursive: true });
  const path = join(STORAGE_DIR, `${filename}.yaml`);
  if (!exist(path)) {
    writeFileSync(path, [sentinel, yaml.dump(template)].join("\n\n"));
    log.warn(
      { path },
      `Wrote a starter ${desc} template. Please edit it and fill in your values.`
    );
  }
  return { path, sentinel };
}

/**
 * Get a config file, populating the template if it doesn't yet exist,
 * and returning it from cache if we've read it before.
 * @param a.filename the name of the config file to read/write
 * @param a.desc a brief description of the contents
 * @param a.validator a Zod-like validator for the schema
 * @param a.template a template to write if the file doesn't exist
 * @returns the parsed config file
 * @throws on validation error, or if the file still contains the example sentinel
 */
function getFile<T>(a: {
  filename: string;
  desc: string;
  validator: Validator<T>;
  template: any;
}): T {
  const { filename, desc, validator } = a;
  if (cache[a.filename]) return cache[filename] as T;

  if (validator(a.template).success) {
    log.fatal(
      { filename, desc },
      `Invalid template for creating a fresh ${desc}. Please fix the template.`
    );
  }
  const { path, sentinel } = initFile(a);
  const raw = readFileSync(path, "utf-8");
  if (raw.includes(sentinel)) {
    log.fatal(
      { path },
      `Example file found. Please edit the ${desc} and fill in your values, then delete the example comment.`
    );
    exit(1);
  }

  const parsed = yaml.load(raw);
  const validated = validator(parsed);
  if (!validated.success) {
    log.fatal({ path, errors: validated.error }, `Error validating ${desc}`);
    exit(1);
  }

  const { data } = validated;
  cache[filename] = data;
  return data;
}

const CONFIG_SPEC = {
  filename: "config",
  desc: "config file",
  validator: CONFIG_SCHEMA.safeParse,
  template: CONFIG_DEFAULTS,
};

const PROFILE_SPEC = {
  filename: "profiles",
  desc: "media profile configuration",
  validator: z.array(PROFILE_SCHEMA).safeParse,
  template: DEFAULT_PROFILES,
};

export function getConfig(): Config & { debridCreds: DebridCreds } {
  const config = getFile(CONFIG_SPEC);
  const debridCreds = parseDebridCreds(config);
  return { ...config, debridCreds };
}

export function getProfiles(): Profile[] {
  return getFile(PROFILE_SPEC);
}

export function initAll() {
  initFile(CONFIG_SPEC);
  initFile(PROFILE_SPEC);
}
