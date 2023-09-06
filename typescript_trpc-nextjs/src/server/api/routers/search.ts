import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const cinemetaHost = "https://v3-cinemeta.strem.io";

async function searchMovie(q: string) {
  const resp = await fetch(
    `${cinemetaHost}/catalog/movie/top/search=${q}.json`
  );
  const data = await resp.json();
  return data;
}

export const searchRouter = createTRPCRouter({
  search: publicProcedure
    .input(
      z.object({
        q: z.string(),
      })
    )
    .query(({ input }) => {
      return searchMovie(input.q);
    }),
});
