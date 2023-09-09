import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { cacheFor } from "../../../utils/cache";
const cinemetaHost = "https://v3-cinemeta.strem.io";
const torrentioHost = "https://torrentio.strem.fun";

const settings = `alldebrid=${process.env.ALLDEBRID_API_KEY}`;

const cache = cacheFor("routers.media");

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
  genres: string[];

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

export interface TorrentioStream {
  /** e.g. `Barbie 2023 1080p WEBRip\n👤 13873 💾 2.1 GB ⚙️ YTS` */
  title: string;
  /** Direct link to the video file streamed from debrid */
  url: string;
  behaviorHints: {
    /** e.g. `torrentio|1080p|WEBRip|hevc|10bit` */
    bingeGroup: string | null;
  };
}

async function search(q: string): Promise<CinemetaSearchResult[]> {
  if (q.trim() === "") return [];
  const [movie, series] = await Promise.all([
    cache.getJSON("searchMovie", () =>
      fetch(`${cinemetaHost}/catalog/movie/top/search=${q}.json`)
    ),
    cache.getJSON("searchSeries", () =>
      fetch(`${cinemetaHost}/catalog/series/top/search=${q}.json`)
    ),
  ]);
  return [...movie.metas, ...series.metas];
}

async function metaMovie(imdbID: string): Promise<CinemetaMovie> {
  const data = await cache.getJSON(`metaMovie-${imdbID}`, () =>
    fetch(`${cinemetaHost}/meta/movie/${imdbID}.json`)
  );
  return data.meta;
}

async function metaSeries(imdbID: string): Promise<CinemetaSeries> {
  const data = await cache.getJSON(`metaSeries-${imdbID}`, () =>
    fetch(`${cinemetaHost}/meta/series/${imdbID}.json`)
  );
  return data.meta;
}

async function torrentMovie(
  settings: string,
  imdbID: string
): Promise<TorrentioStream[]> {
  const data = await cache.getJSON(`torrentMovie-${imdbID}`, () =>
    fetch(`${torrentioHost}/${settings}/stream/movie/${imdbID}.json`)
  );
  return data.streams;
}

async function torrentSeries(
  settings: string,
  imdbID: string,
  season: number,
  episode: number
): Promise<TorrentioStream[]> {
  const data = await cache.getJSON(
    `torrentSeries-${imdbID}-${season}-${episode}`,
    () =>
      fetch(
        `${torrentioHost}/${settings}/stream/series/${imdbID}:${season}:${episode}.json`
      )
  );
  return data.streams;
}

export const mediaRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({ q: z.string().nullable() }))
    .query(({ input }) => {
      if (!input.q) return null;
      return search(input.q);
    }),
  meta: createTRPCRouter({
    movie: publicProcedure
      .input(z.object({ imdbID: z.string() }))
      .query(({ input }) => metaMovie(input.imdbID)),
    series: publicProcedure
      .input(z.object({ imdbID: z.string() }))
      .query(({ input }) => metaSeries(input.imdbID)),
  }),
  torrent: createTRPCRouter({
    movie: publicProcedure
      .input(z.object({ imdbID: z.string() }))
      .query(({ input }) => torrentMovie(settings, input.imdbID)),
    series: publicProcedure
      .input(
        z.object({
          imdbID: z.string(),
          season: z.number(),
          episode: z.number(),
        })
      )
      .query(({ input }) =>
        torrentSeries(settings, input.imdbID, input.season, input.episode)
      ),
  }),
});