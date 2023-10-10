import { Level } from "level";
import { ZodSchema, z } from "zod";
import { Logger } from "pino";
import log from "../log";

const datedSchema = z.object({ d: z.date(), v: z.any() });
type Dated = z.infer<typeof datedSchema>;

function isNotFound(e: any): e is { cause: { code: string } } {
  return e.cause?.code === "LEVEL_NOT_FOUND";
}

export class DiskLRU<T> {
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

  async get(key: string, fn: () => Promise<T>): Promise<T | null> {
    let dated: Dated;
    try {
      const raw = await this.sl.get(key);
      dated = datedSchema.parse(JSON.parse(raw));
    } catch (e) {
      if (isNotFound(e)) {
        const newVal = await fn();
        await this.put(key, newVal);
        return newVal;
      }
      throw e;
    }

    if (this.isExpired(dated)) {
      this.log.debug("expired", { key });
      const newVal = await fn();
      await this.put(key, newVal);
      return newVal;
    }

    return this.schema.parse(dated.v);
  }
}
