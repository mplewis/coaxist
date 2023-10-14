import z from "zod";

/** A request made in Overseerr. */
export type OverseerrRequest = OverseerrRequestTV | OverseerrRequestMovie;
/** A request made in Overseerr for a TV show. */
export type OverseerrRequestTV = {
  type: "tv";
  title: string;
  imdbID: string;
  seasons: {
    season: number;
    episodes: { episode: number; airDate: string }[];
  }[];
};
/** A request made in Overseerr for a movie. */
export type OverseerrRequestMovie = {
  type: "movie";
  title: string;
  imdbID: string;
  releaseDate: string;
};

/** A Zod schema which returns validated data or an error. */
export interface Schema<T> {
  safeParse: (
    input: unknown
  ) => { success: true; data: T } | { success: false; error: z.ZodError };
}

/** The schema for the request data from Overseerr. */
export const RAW_REQUEST_SCHEMA = z.object({
  media: z.object({
    mediaType: z.enum(["movie", "tv"]),
    tmdbId: z.number(),
  }),
  seasons: z.array(z.object({ seasonNumber: z.number() })),
});
/** The request data from Overseerr. */
export type RawRequest = z.infer<typeof RAW_REQUEST_SCHEMA>;

/** The schema for Plex watchlist items from Overseerr. */
export const WATCHLIST_ITEM_SCHEMA = z.object({
  title: z.string(),
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number(),
});
/** A Plex watchlist item from Overseerr. */
export type WatchlistItem = z.infer<typeof WATCHLIST_ITEM_SCHEMA>;

/** The schema for a page of Plex watchlist items from Overseerr. */
export const WATCHLIST_PAGE_SCHEMA = z.object({
  page: z.number(),
  totalPages: z.number(),
  totalResults: z.number(),
  results: z.array(WATCHLIST_ITEM_SCHEMA),
});

/** The schema for the metadata for a movie from Overseerr. */
export const MOVIE_METADATA_SCHEMA = z.object({
  title: z.string(),
  releaseDate: z.string(),
  externalIds: z.object({ imdbId: z.string() }),
});
/** The metadata for a movie from Overseerr. */
export type MovieMetadata = z.infer<typeof MOVIE_METADATA_SCHEMA>;

/** The schema for the metadata for a TV show from Overseerr. */
export const TV_SHOW_METADATA_SCHEMA = z.object({
  name: z.string(),
  externalIds: z.object({ imdbId: z.string() }),
  seasons: z.array(z.object({ seasonNumber: z.number() })),
});
/** The metadata for a TV show from Overseerr. */
export type TVShowMetadata = z.infer<typeof TV_SHOW_METADATA_SCHEMA>;

/** The schema for the metadata for a season of a TV show from Overseerr. */
export const TV_SEASON_METADATA_SCHEMA = z.object({
  episodes: z.array(
    z.object({
      episodeNumber: z.number(),
      airDate: z.string().or(z.null()),
    })
  ),
});
/** A season of a TV show from Overseerr. */
export type TVSeasonMetadata = z.infer<typeof TV_SEASON_METADATA_SCHEMA>;
