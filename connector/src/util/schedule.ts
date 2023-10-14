import ms from "ms";

import log from "../log";

import { sleep } from "./sleep";

const MIN_TIME_BETWEEN_TASKS = ms("5s");

/** Schedule a task to run periodically. */
export function schedule(
  desc: string,
  intervalMs: number,
  task: () => Promise<void>
) {
  (async () => {
    for (;;) {
      log.debug({ task: desc }, "running periodic task");
      const start = new Date();
      // eslint-disable-next-line no-await-in-loop
      await task();
      const end = new Date();
      const durationMs = end.getTime() - start.getTime();
      log.debug({ task: desc, durationMs }, "periodic task complete");

      const scheduledNext = start.getTime() + intervalMs;
      const minNext = end.getTime() + MIN_TIME_BETWEEN_TASKS;
      const next = new Date(Math.max(scheduledNext, minNext));
      const sleepMs = next.getTime() - end.getTime();
      // eslint-disable-next-line no-await-in-loop
      await sleep(sleepMs);
    }
  })();
  setInterval(async () => {}, intervalMs);
  const intervalDesc = ms(intervalMs, { long: true });
  log.info({ task: desc, interval: intervalDesc }, "registered periodic task");
}
