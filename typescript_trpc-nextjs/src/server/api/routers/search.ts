import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const cinemetaHost = "https://v3-cinemeta.strem.io";

export interface CinemetaSearchResult {
  type: "movie" | "series" | string;
  imdb_id: string;
  name: string;
  releaseInfo: string;
  poster: string;
}

export interface CinemetaMovie {
  type: "movie";
  imdb_id: string;

  name: string;
  year: string;
  description: string;

  country: string;
  director: string[];
  writer: string[];
  cast: string[];
  genre: string[];

  poster: string;
  background: string;
  logo: string;
  runtime: string;
}

async function search(q: string): Promise<CinemetaSearchResult[]> {
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

async function movie(imdbID: string): Promise<CinemetaMovie> {
  const res = await fetch(`${cinemetaHost}/meta/movie/${imdbID}.json`);
  console.log(res);
  const data = await res.json();
  console.log(data);
  return data.meta;
}

export const mediaRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({ q: z.string() }))
    .query(({ input }) => search(input.q)),
  movie: publicProcedure
    .input(z.object({ imdbID: z.string() }))
    .query(({ input }) => movie(input.imdbID)),
});
