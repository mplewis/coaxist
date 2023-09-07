import { createTRPCRouter } from "./trpc";
import { mediaRouter } from "./routers/media";

export const appRouter = createTRPCRouter({
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
