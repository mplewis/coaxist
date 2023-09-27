import { join } from "path";
import yaml from "js-yaml";
import { readFileSync, writeFileSync } from "fs";
import ini from "ini";
import { DebridConfig, UBERCONF_SCHEMA, Uberconf } from "./uberconf.types";

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

export function buildRcloneConf(dc: DebridConfig): string {
  const rc = rcloneConf(dc);
  const data = {
    provider: {
      type: "webdav",
      vendor: "other",
      url: rc.WEBDAV_URL,
      user: rc.WEBDAV_USER,
      pass: rc.WEBDAV_PASS,
    },
  };
  return ini.encode(data, { whitespace: true });
}

export function parseConfig(rootConfigDir: string): Uberconf {
  const path = join(rootConfigDir, "config.yaml");
  const raw = readFileSync(path, "utf-8");
  const data = yaml.load(raw);
  return UBERCONF_SCHEMA.parse(data);
}

export function writeExternalConfigFiles(rootConfigDir: string, c: Uberconf) {
  writeFileSync(
    join(rootConfigDir, "rclone", "rclone.conf"),
    buildRcloneConf(c.debrid)
  );
}
