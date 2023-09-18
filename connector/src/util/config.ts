import { statSync } from "fs";
import yaml from "js-yaml";
import z from "zod";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";
import log from "../log";
import packageJSON from "../../package.json";
import { DEFAULT_PROFILES, PROFILE_SCHEMA } from "../logic/profile";

export const { version: VERSION } = packageJSON;

const STORAGE_DIR = process.env.STORAGE_DIR || "/config/connector";

const YAML_TEMPLATE_SENTINEL = (name: string) =>
  `# This is an example ${name}. Please fill in your values, then delete this line.`;

const CONFIG_SCHEMA = z.object({
  ALLDEBRID_API_KEY: z.string(),
  DATABASE_URL: z.string(),
  OVERSEERR_API_KEY: z.string(),
  OVERSEERR_HOST: z.string().url(),
});
const CONFIG_DEFAULTS: Config = {
  ALLDEBRID_API_KEY: "<your API key goes here>",
  DATABASE_URL: `file:${join(STORAGE_DIR, "db.sqlite")}`,
  OVERSEERR_API_KEY: "<your API key goes here>",
  OVERSEERR_HOST: "http://localhost:5055",
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

function exist(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
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
async function getFile<T>(a: {
  filename: string;
  desc: string;
  validator: Validator<T>;
  template: T;
}) {
  const { filename, desc, validator, template } = a;
  if (cache[a.filename]) return cache[filename] as T;

  const sentinel = YAML_TEMPLATE_SENTINEL(desc);

  await mkdir(STORAGE_DIR, { recursive: true });
  const path = join(STORAGE_DIR, `${filename}.yaml`);
  if (!exist(path)) {
    await writeFile(path, [sentinel, yaml.dump(template)].join("\n\n"));
    log.warn(
      { path },
      `Wrote a starter ${desc} template. Please edit it and fill in your values.`
    );
  }

  const raw = await readFile(path, "utf-8");
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

export async function getConfig() {
  return getFile({
    filename: "config",
    desc: "config file",
    validator: CONFIG_SCHEMA.safeParse,
    template: CONFIG_DEFAULTS,
  });
}

export async function getProfiles() {
  return getFile({
    filename: "profiles",
    desc: "media profile configuration",
    validator: z.array(PROFILE_SCHEMA).safeParse,
    template: DEFAULT_PROFILES,
  });
}
