import { Level } from "level";
import ms from "ms";
import { Logger } from "pino";
import { ZodSchema, z } from "zod";

import log from "../log";

const GC_INTERVAL = ms("1h");

const datedSchema = z.object({ d: z.date({ coerce: true }), v: z.any() });
type Dated = z.infer<typeof datedSchema>;

function isNotFound(e: any): e is { code: string } {
  return e?.code === "LEVEL_NOT_FOUND";
}

/** A TTL cache that persists data to disk using Level. */
export class Cache<T> {
  log: Logger;

  constructor(
    private readonly db: Level,
    private readonly namespace: string,
    private readonly expiryMs: number,
    private readonly schema: ZodSchema<T>
  ) {
    this.log = log.child({ namespace, expiryMs });
    this.gc();
    setInterval(() => this.gc(), GC_INTERVAL);
  }

  /** Use `this.sl` as the database, NOT `this.db`. */
  private get sl() {
    return this.db.sublevel(this.namespace);
  }

  /** Return true if the given item is expired. */
  private isExpired(dated: Dated) {
    const now = new Date();
    const age = now.getTime() - dated.d.getTime();
    return age >= this.expiryMs;
  }

  /** Set a value in the namespace. */
  private async put(key: string, val: T): Promise<void> {
    const dated = { d: new Date(), v: val };
    return this.sl.put(key, JSON.stringify(dated));
  }

  /** Clean up all expired keys. */
  private async gc(): Promise<void> {
    this.log.debug("running garbage collection");
    const start = new Date();
    for await (const key of this.sl.keys()) {
      const raw = await this.sl.get(key);
      const rawData = JSON.parse(raw);
      const dated = datedSchema.parse(rawData);
      if (this.isExpired(dated)) await this.sl.del(key);
    }
    const duration = new Date().getTime() - start.getTime();
    this.log.debug({ durationMs: duration }, "garbage collection complete");
  }

  /**
   * Get a value from the cache, or populate the value.
   * @param key The key representing the value to get
   * @param fn The function to use to populate the value if it's not found or expired
   * @returns The value, or the error that occurred while getting it or populating it
   */
  async get<E>(
    key: string,
    fn: () => Promise<
      { success: true; data: T } | { success: false; errors: E[] }
    >
  ): Promise<
    { success: true; data: T } | { success: false; errors: (E | Error)[] }
  > {
    const klog = this.log.child({ key });

    let raw: string;
    try {
      raw = await this.sl.get(key);
    } catch (e) {
      if (isNotFound(e)) {
        klog.debug("initializing");
        const newVal = await fn();
        if (newVal.success) await this.put(key, newVal.data);
        return newVal;
      }
      return { success: false, errors: [e as Error] };
    }

    const rawData = JSON.parse(raw);
    const dated = datedSchema.parse(rawData);
    if (this.isExpired(dated)) {
      klog.debug("refreshing");
      const newVal = await fn();
      if (newVal.success) await this.put(key, newVal.data);
      return newVal;
    }

    const data = this.schema.parse(dated.v);
    return { success: true, data };
  }
}
