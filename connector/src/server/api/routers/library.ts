import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { PrismaClient } from "@prisma/client";

const zMediaType = z.literal("movie").or(z.literal("series"));
type MediaType = z.infer<typeof zMediaType>;

async function add(db: PrismaClient, type: MediaType, imdbID: string) {
  return db.media.create({ data: { type, imdbID } });
}

async function remove(db: PrismaClient, imdbID: string) {
  return db.media.delete({ where: { imdbID } });
}

async function get(db: PrismaClient, imdbID: string) {
  return db.media.findUnique({ where: { imdbID } });
}

async function list(db: PrismaClient) {
  return db.media.findMany();
}

export const libraryRouter = createTRPCRouter({
  add: publicProcedure
    .input(z.object({ type: zMediaType, imdbID: z.string() }))
    .mutation(({ input, ctx }) => add(ctx.prisma, input.type, input.imdbID)),
  remove: publicProcedure
    .input(z.object({ imdbID: z.string() }))
    .mutation(({ input, ctx }) => remove(ctx.prisma, input.imdbID)),
  get: publicProcedure
    .input(z.object({ imdbID: z.string() }))
    .query(({ input, ctx }) => get(ctx.prisma, input.imdbID)),
  list: publicProcedure.query(({ ctx }) => list(ctx.prisma)),
});
