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

const searchResultSchema = z.object({
  age: z.number(),
  ageHours: z.number(),
  ageMinutes: z.number(),
  approved: z.boolean(),
  categories: z.array(categorySchema),
  downloadUrl: z.string(),
  fileName: z.string(),
  guid: z.string(),
  imdbId: z.number(),
  indexer: z.string(),
  indexerFlags: z.array(z.string()),
  indexerId: z.number(),
  infoHash: z.string().optional(),
  infoUrl: z.string(),
  leechers: z.number(),
  magnetUrl: z.string().optional(),
  posterUrl: z.string().optional(),
  protocol: z.string(),
  publishDate: z.string(),
  seeders: z.number(),
  size: z.number(),
  sortTitle: z.string(),
  title: z.string(),
});

export class ProwlarrClient {
  constructor(
    private host: string,
    private apiKey: string
  ) {}

  async search(category: ProwlarrCategory, imdbID: string) {
    const url = {
      url: `${this.host}/api/v1/search`,
      query: {
        type: "search",
        query: `{imdbId:${imdbID}}`,
        categories: PROWLARR_CATEGORIES[category],
      },
    };
    const headers = { "X-Api-Key": this.apiKey };
    return getJSON(url, z.array(searchResultSchema), { headers });
  }
}
