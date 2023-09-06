import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const cinemetaHost = "https://v3-cinemeta.strem.io";

export interface CinemetaResult {
  type: "movie" | "series" | string;
  imdb_id: string;
  name: string;
  releaseInfo: string;
  poster: string;
}

async function search(q: string): Promise<CinemetaResult[]> {
  const movieReq = fetch(`${cinemetaHost}/catalog/movie/top/search=${q}.json`);
  const seriesReq = fetch(
    `${cinemetaHost}/catalog/series/top/search=${q}.json`
  );
  const [movieRes, seriesRes] = await Promise.all([movieReq, seriesReq]);
  const [movie, series] = await Promise.all([
    movieRes.json(),
    seriesRes.json(),
  ]);
  return [...movie.metas, ...series.metas];
}

export const mediaRouter = createTRPCRouter({
  search: publicProcedure
    .input(
      z.object({
        q: z.string(),
      })
    )
    .query(({ input }) => {
      return search(input.q);
    }),
});
