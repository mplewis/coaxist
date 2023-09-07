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

export interface CinemetaDetails {
  type: "movie" | "series";
  imdb_id: string;

  name: string;
  year: string;
  description: string;
  runtime: string;
  country: string;
  genre: string[];

  director: string[];
  writer: string[];
  cast: string[];

  poster: string;
  background: string;
  logo: string;
}

export interface CinemetaMovie extends CinemetaDetails {
  type: "movie";
}

export interface CinemetaSeries extends CinemetaDetails {
  type: "series";
  videos: CinemetaEpisode[];
}

export interface CinemetaEpisode {
  /** tt0804484:2:8 for Foundation S02E08 */
  id: string;
  /** per-episode */
  tvdb_id: number;
  season: number;
  episode: number;
  /** ISO8601 date. If this episode hasn't come out yet, this will be in the future. */
  released: string;

  name: string;
  description: string;

  thumbnail: string;
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
  const data = await res.json();
  return data.meta;
}

async function series(imdbID: string): Promise<CinemetaSeries> {
  const res = await fetch(`${cinemetaHost}/meta/series/${imdbID}.json`);
  const data = await res.json();
  return data.meta;
}

export const mediaRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({ q: z.string() }))
    .query(({ input }) => search(input.q)),
  movie: publicProcedure
    .input(z.object({ imdbID: z.string() }))
    .query(({ input }) => movie(input.imdbID)),
  series: publicProcedure
    .input(z.object({ imdbID: z.string() }))
    .query(({ input }) => series(input.imdbID)),
});
