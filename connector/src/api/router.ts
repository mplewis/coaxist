import { initTRPC } from "@trpc/server";
import { z } from "zod";

type User = {
  id: string;
  name: string;
  bio?: string;
};

const users: Record<string, User> = {};

export const t = initTRPC.create();

export const router = t.router({
  getUserById: t.procedure.input(z.string()).query(
    (opts) => users[opts.input] // input type is string
  ),
  createUser: t.procedure
    .input(
      z.object({
        name: z.string().min(3),
        bio: z.string().max(142).optional(),
      })
    )
    .mutation((opts) => {
      const id = Date.now().toString();
      const user: User = { id, ...opts.input };
      users[user.id] = user;
      return user;
    }),
});
