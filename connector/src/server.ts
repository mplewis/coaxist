import Fastify from "fastify";
const fastify = Fastify({
  logger: true,
});

fastify.get("/", function (req, res) {
  res.send({ hello: "world" });
});

export function serve() {
  fastify.listen({ port: 3000 }, (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
}
