import z from "zod";
import { getJSON } from "./http";

export type ProwlarrCategory = keyof typeof PROWLARR_CATEGORIES;
export const PROWLARR_CATEGORIES = {
  movies: 2000,
  tv: 5000,
};

const baseCategorySchema = z.object({
  id: z.number(),
  name: z.string().optional(),
});
type Category = z.infer<typeof baseCategorySchema> & {
  subCategories: Category[];
};
const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
  subCategories: z.array(z.lazy(() => categorySchema)),
});

const baseSearchResultSchema = z.object({
  age: z.number(),
  ageHours: z.number(),
  ageMinutes: z.number(),
  approved: z.boolean(),
  categories: z.array(categorySchema),
  fileName: z.string(),
  guid: z.string(),
  imdbId: z.number(),
  indexer: z.string(),
  indexerFlags: z.array(z.string()),
  indexerId: z.number(),
  infoUrl: z.string(),
  leechers: z.number(),
  posterUrl: z.string().optional(),
  protocol: z.string(),
  publishDate: z.string(),
  seeders: z.number(),
  size: z.number(),
  sortTitle: z.string(),
  title: z.string(),
});

const pointerSchema = z.union([
  z.object({ downloadUrl: z.string() }),
  z.object({ infoHash: z.string(), magnetUrl: z.string() }),
]);

const searchResultSchema = z.intersection(
  baseSearchResultSchema,
  pointerSchema
);

export class ProwlarrClient {
  constructor(
    private host: string,
    private apiKey: string
  ) {}

  async search(
    category: ProwlarrCategory,
    criteria: { query: string } | { imdbID: string }
  ) {
    const query =
      "imdbID" in criteria ? `{imdbId:${criteria.imdbID}}` : criteria.query;
    const url = {
      url: `${this.host}/api/v1/search`,
      query: {
        query,
        type: "search",
        categories: PROWLARR_CATEGORIES[category],
      },
    };
    const headers = { "X-Api-Key": this.apiKey };
    return getJSON(url, z.array(searchResultSchema), { headers });
  }
}
