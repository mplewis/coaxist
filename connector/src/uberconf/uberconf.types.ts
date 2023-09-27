import ms from "ms";
import z from "zod";
import { PROFILE_SCHEMA } from "../data/profile";

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
