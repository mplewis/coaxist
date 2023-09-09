import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { createContext } from "./api/context";
import { router } from "./api/router";

const server = Fastify({
  logger: true,
});

server.get("/", function (req, res) {
  res.send({ hello: "world" });
});

server.register(fastifyTRPCPlugin, {
  prefix: "/api",
  trpcOptions: { router, createContext },
});

export function serve() {
  server.listen({ port: 3000 }, (err) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
  });
}
