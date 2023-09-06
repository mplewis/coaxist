import { createTRPCRouter } from "./trpc";
import { postRouter } from "./routers/post";
import { userRouter } from "./routers/user";
import { mediaRouter } from "./routers/search";

export const appRouter = createTRPCRouter({
  post: postRouter,
  user: userRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
