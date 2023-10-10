import { Level } from "level";
import { ZodSchema, z } from "zod";
import { Logger } from "pino";
import log from "../log";

const datedSchema = z.object({ d: z.date({ coerce: true }), v: z.any() });
type Dated = z.infer<typeof datedSchema>;

function isNotFound(e: any): e is { code: string } {
  return e?.code === "LEVEL_NOT_FOUND";
}

export class DiskCache<T> {
  log: Logger;

  constructor(
    private readonly db: Level,
    private readonly namespace: string,
    private readonly expiryMs: number,
    private readonly schema: ZodSchema<T>
  ) {
    this.log = log.child({ namespace, expiryMs });
  }

  private get sl() {
    return this.db.sublevel(this.namespace);
  }

  private isExpired(dated: Dated) {
    const now = new Date();
    const age = now.getTime() - dated.d.getTime();
    return age >= this.expiryMs;
  }

  private async put(key: string, val: T): Promise<void> {
    const dated = { d: new Date(), v: val };
    return this.sl.put(key, JSON.stringify(dated));
  }

  async get(
    key: string,
    fn: () => Promise<T>
  ): Promise<{ success: true; data: T } | { success: false; error: Error }> {
    const klog = this.log.child({ key });

    let raw: string;
    try {
      raw = await this.sl.get(key);
    } catch (e) {
      if (isNotFound(e)) {
        klog.debug("initializing");
        const newVal = await fn();
        await this.put(key, newVal);
        return { success: true, data: newVal };
      }
      return { success: false, error: e as Error };
    }

    const rawData = JSON.parse(raw);
    const dated = datedSchema.parse(rawData);
    if (this.isExpired(dated)) {
      klog.debug("refreshing");
      const newVal = await fn();
      await this.put(key, newVal);
      return { success: true, data: newVal };
    }

    const data = this.schema.parse(dated.v);
    return { success: true, data };
  }
}
