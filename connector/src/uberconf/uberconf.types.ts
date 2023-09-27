import ms from "ms";
import z from "zod";

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

export const UBERCONF_SCHEMA = z.object({
  debrid: z.union([
    z.object({ realDebrid: types.userPassAPI }),
    z.object({ allDebrid: types.api }),
    // TODO: DebridLink
    // TODO: Offcloud
    // TODO: Premiumize
    // TODO: Put.io
  ]),

  connector: z.object({
    search: z.object({
      outstandingSearchInterval: positiveDuration.default('1h'),
      beforeReleaseDate: positiveDuration.default('7d'),
    }),
    snatch: z.object({
      refreshWithinExpiry: positiveDuration.default('2d'),
      debridExpiry: positiveDuration.default('14d'),
      refreshCheckInterval: positiveDuration.default('1h'),
    }),
    overseerr: z.object({
      pollInterval: positiveDuration.default('15s'),
      requestConcurrency: z.number().int().positive().default(5),
    }),
    torrentio: z.object({
      requestConcurrency: z.number().int().positive().default(5),
    }),
  }),
});
export type Uberconf = z.infer<typeof UBERCONF_SCHEMA>;
export type UberconfInput = z.input<typeof UBERCONF_SCHEMA>;

function rcloneConf(c: Uberconf): {
  WEBDAV_URL: string;
  WEBDAV_USER: string;
  WEBDAV_PASS: string;
} {
  if ("realDebrid" in c.debrid) {
    return {
      WEBDAV_URL: "https://dav.real-debrid.com/",
      WEBDAV_USER: c.debrid.realDebrid.username,
      WEBDAV_PASS: c.debrid.realDebrid.password,
    };
  }
  if ("allDebrid" in c.debrid) {
    return {
      WEBDAV_URL: "https://webdav.debrid.it/",
      WEBDAV_USER: c.debrid.allDebrid.apiKey,
      WEBDAV_PASS: RCLONE_DUMMY_PASSWORD,
    };
  }
  const exhaustiveCheck: never = c.debrid;
  throw new Error(`unhandled debrid type: ${exhaustiveCheck}`);
}

function connectorConf(c: Uberconf):
