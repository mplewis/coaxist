import { describe, expect, it } from "vitest";
import { withDir } from "tmp-promise";
import { Level } from "level";
import z from "zod";
import { DiskLRU } from "./diskCache";

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("DiskLRU", () => {
  it("caches values as expected", async () => {
    withDir(async ({ path }) => {
      const level = new Level(path);
      const schema = z.object({ name: z.string() });
      const short = new DiskLRU(level, "short", 10, schema);
      const long = new DiskLRU(level, "long", 500, schema);

      const l1 = await long.get("gundam", async () => ({
        name: "The 08th MS Team",
      }));
      expect(l1).toEqual({ name: "The 08th MS Team" });

      const s1 = await short.get("gundam", async () => ({
        name: "Witch from Mercury",
      }));
      expect(s1).toEqual({ name: "Witch from Mercury" });

      const s2 = await short.get("gundam", async () => ({
        name: "Gundam SEED",
      }));
      expect(s2).toEqual({ name: "Witch from Mercury" });

      await sleep(10);
      const s3 = await short.get("gundam", async () => ({
        name: "Gundam SEED",
      }));
      expect(s3).toEqual({ name: "Gundam SEED" });

      const l2 = await long.get("gundam", async () => ({
        name: "Stardust Memory",
      }));
      expect(l2).toEqual({ name: "The 08th MS Team" });
    });
  });

  it("supports complex values", async () => {
    withDir(async ({ path }) => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        quirks: z.array(z.string()),
      });
      const level = new Level(path);
      const db = new DiskLRU(level, "complex", 1000, schema);

      const val = await db.get("kitty", async () => ({
        name: "Proxima Nova",
        age: 3,
        quirks: ["spicy", "fluffy", "assertive"],
      }));
      expect(val).toEqual({
        name: "Proxima Nova",
        age: 3,
        quirks: ["spicy", "fluffy", "assertive"],
      });
    });
  });
});
