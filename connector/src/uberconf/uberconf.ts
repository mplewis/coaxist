import { dirname, join } from "path";
import yaml from "js-yaml";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import ini from "ini";
import execa from "execa";
import { DebridConfig, UBERCONF_SCHEMA, UberConf } from "./uberconf.types";
import log from "../log";

const EXAMPLE_FILE_SENTINEL = "### THIS_IS_AN_EXAMPLE_FILE ###";
const RCLONE_DUMMY_PASSWORD =
  "m3PAV6DJIEGo4fuVlinAGtWZZXH0z_yabANkILj-ENwknWUnYkBDNK7TjbQ"; // rclone obscure dummy-password-please-ignore

function rcloneConf(dc: DebridConfig): {
  WEBDAV_URL: string;
  WEBDAV_USER: string;
  WEBDAV_PASS: string;
} {
  if ("realDebrid" in dc) {
    return {
      WEBDAV_URL: "https://dav.real-debrid.com/",
      WEBDAV_USER: dc.realDebrid.username,
      WEBDAV_PASS: dc.realDebrid.password,
    };
  }
  if ("allDebrid" in dc) {
    return {
      WEBDAV_URL: "https://webdav.debrid.it/",
      WEBDAV_USER: dc.allDebrid.apiKey,
      WEBDAV_PASS: RCLONE_DUMMY_PASSWORD,
    };
  }
  const exhaustiveCheck: never = dc;
  throw new Error(`unhandled debrid type: ${exhaustiveCheck}`);
}

function exists(path: string) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function write(path: string, data: string) {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, data);
}

function obscure(password: string) {
  // call `rclone obscure $password`
  const result = execa.sync("rclone", ["obscure", password]);
  return result.stdout;
}

export function buildRcloneConf(dc: DebridConfig): string {
  const rc = rcloneConf(dc);
  const pass = obscure(rc.WEBDAV_PASS);
  const data = {
    provider: {
      type: "webdav",
      vendor: "other",
      url: rc.WEBDAV_URL,
      user: rc.WEBDAV_USER,
      pass,
    },
  };
  return ini.encode(data, { whitespace: true });
}

export function loadOrInitUberConf(path: string): UberConf {
  if (!exists(path)) {
    const dfault = readFileSync(join(__dirname, "default.yaml"), "utf-8");
    write(path, dfault);
    log.info(
      { path },
      `Created config file with example values. Please edit the new config file, ` +
        `fill in your desired values, remove ${EXAMPLE_FILE_SENTINEL}, and run this program again.`
    );
    process.exit(1);
  }

  const raw = readFileSync(path, "utf-8");
  if (raw.includes(EXAMPLE_FILE_SENTINEL)) {
    log.fatal(
      { path },
      `The config file contains ${EXAMPLE_FILE_SENTINEL}. Please edit the config file, ` +
        `fill in your desired values, remove ${EXAMPLE_FILE_SENTINEL}, and run this program again.`
    );
    process.exit(1);
  }

  const data = yaml.load(raw);
  const parsed = UBERCONF_SCHEMA.parse(data);
  log.info({ path }, "Loaded UberConf config file");
  return parsed;
}

export function writeExternalConfigFiles(rootConfigDir: string, c: UberConf) {
  const path = join(rootConfigDir, "rclone", "rclone.conf");
  write(path, buildRcloneConf(c.debrid));
  log.info({ path }, "Wrote Rclone config file");
}
