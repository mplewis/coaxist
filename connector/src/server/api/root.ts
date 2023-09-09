import { createTRPCRouter } from "./trpc";
import { mediaRouter } from "./routers/media";
import { libraryRouter } from "./routers/library";

import "../init"; // HACK

export const appRouter = createTRPCRouter({
  media: mediaRouter,
  library: libraryRouter,
});

export type AppRouter = typeof appRouter;
