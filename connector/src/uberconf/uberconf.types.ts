import ms from "ms";
import z from "zod";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";
import ini from "ini";
import { PROFILE_SCHEMA } from "../data/profile";

const RCLONE_DUMMY_PASSWORD =
  "m3PAV6DJIEGo4fuVlinAGtWZZXH0z_yabANkILj-ENwknWUnYkBDNK7TjbQ"; // rclone obscure dummy-password-please-ignore

export const positiveDuration = z
  .string()
  .transform(ms)
  .refine((val) => val > 0, {
    message:
      "Must be a positive duration string (e.g. 15s, 2h, 1d). See: https://github.com/vercel/ms#examples",
  });

const types = {
  userPassAPI: z.object({
    username: z.string(),
    password: z.string(),
    apiKey: z.string(),
  }),
  api: z.object({
    apiKey: z.string(),
  }),
};

export const DEBRID_SCHEMA = z.union([
  z.object({ realDebrid: types.userPassAPI }),
  z.object({ allDebrid: types.api }),
  // TODO: DebridLink
  // TODO: Offcloud
  // TODO: Premiumize
  // TODO: Put.io
]);
export type DebridConfig = z.infer<typeof DEBRID_SCHEMA>;

export const CONNECTOR_SCHEMA = z
  .object({
    search: z
      .object({
        outstandingSearchInterval: positiveDuration.default("1h"),
        beforeReleaseDate: positiveDuration.default("7d"),
      })
      .default({}),
    snatch: z
      .object({
        refreshWithinExpiry: positiveDuration.default("2d"),
        debridExpiry: positiveDuration.default("14d"),
        refreshCheckInterval: positiveDuration.default("1h"),
      })
      .default({}),
    overseerr: z
      .object({
        pollInterval: positiveDuration.default("15s"),
        requestConcurrency: z.number().int().positive().default(5),
      })
      .default({}),
    torrentio: z
      .object({
        requestConcurrency: z.number().int().positive().default(5),
      })
      .default({}),
  })
  .default({});
export type ConnectorConfig = z.infer<typeof CONNECTOR_SCHEMA>;

export const UBERCONF_SCHEMA = z.object({
  debrid: DEBRID_SCHEMA,
  connector: CONNECTOR_SCHEMA,
  mediaProfiles: z.array(PROFILE_SCHEMA),
});
export type Uberconf = z.infer<typeof UBERCONF_SCHEMA>;

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

function writeConfigFiles(rootConfigDir: string, c: Uberconf) {
  // writeTemplate(
  //   "rclone.conf",
  //   join(rootConfigDir, "rclone", "rclone.conf"),
  //   rcloneConf(c)
  // );
}
