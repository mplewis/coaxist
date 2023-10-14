import ms from "ms";

import log from "../log";

export function schedule(
  desc: string,
  intervalMs: number,
  task: () => Promise<void>
) {
  setInterval(async () => {
    log.debug({ task: desc }, "running periodic task");
    const start = new Date();
    await task();
    log.debug(
      { task: desc, durationMs: new Date().getTime() - start.getTime() },
      "periodic task complete"
    );
  }, intervalMs);
  const intervalDesc = ms(intervalMs, { long: true });
  log.info({ task: desc, interval: intervalDesc }, "registered periodic task");
}
