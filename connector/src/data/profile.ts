import z from "zod";
import { QUALITY_RANKING } from "./quality";
import { TAGS } from "./tag";

const SUPPORTED_SORTS = ["mostSeeders", "largestFileSize"] as const;
export type SupportedSort = (typeof SUPPORTED_SORTS)[number];
const DEFAULT_SORT = "largestFileSize";

const MINMAX_SCHEMA = z
  .object({
    quality: z.enum(QUALITY_RANKING).optional(),
    seeders: z.number().positive().optional(),
  })
  .optional();
export const PROFILE_SCHEMA = z.object({
  name: z.string(),
  sort: z.enum(SUPPORTED_SORTS).default(DEFAULT_SORT),
  minimum: MINMAX_SCHEMA,
  maximum: MINMAX_SCHEMA,
  required: z.array(z.enum(TAGS)).optional(),
  preferred: z.array(z.enum(TAGS)).optional(),
  discouraged: z.array(z.enum(TAGS)).optional(),
  forbidden: z.array(z.enum(TAGS)).optional(),
});
/** A user-defined media profile used to select a candidate for download from a list of search results. */
export type Profile = z.infer<typeof PROFILE_SCHEMA>;
export type ProfileInput = z.input<typeof PROFILE_SCHEMA>;

export const DEFAULT_PROFILES: ProfileInput[] = [
  {
    name: "(example) Most Compatible",
    maximum: { quality: "1080p" },
    discouraged: ["hdr"],
    forbidden: ["dolbyvision", "h265"],
  },
  {
    name: "(example) Remux Only",
    required: ["remux"],
  },
  {
    name: "(example) High Definition",
    minimum: { quality: "720p" },
    forbidden: ["cam"],
  },
];
