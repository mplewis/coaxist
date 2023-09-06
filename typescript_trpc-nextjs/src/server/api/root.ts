import { createTRPCRouter } from "./trpc";
import { postRouter } from "./routers/post";
import { userRouter } from "./routers/user";
import { searchRouter } from "./routers/search";

export const appRouter = createTRPCRouter({
  post: postRouter,
  user: userRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
