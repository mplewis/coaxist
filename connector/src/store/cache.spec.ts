import { Level } from "level";
import { withDir } from "tmp-promise";
import { describe, expect, it } from "vitest";
import z from "zod";

import { sleep } from "../util/sleep";

import { Cache } from "./cache";

describe("Cache", () => {
  it("caches values as expected", async () => {
    await withDir(
      async ({ path }) => {
        const level = new Level(path);
        const schema = z.object({ name: z.string() });
        const short = new Cache(level, "short", 10, schema);
        const long = new Cache(level, "long", 500, schema);

        const l1 = await long.get("gundam", async () => ({
          success: true,
          data: { name: "The 08th MS Team" },
        }));
        expect(l1).toEqual({
          success: true,
          data: { name: "The 08th MS Team" },
        });

        const s1 = await short.get("gundam", async () => ({
          success: true,
          data: { name: "Witch from Mercury" },
        }));
        expect(s1).toEqual({
          success: true,
          data: { name: "Witch from Mercury" },
        });

        const s2 = await short.get("gundam", async () => ({
          success: true,
          data: { name: "Gundam SEED" },
        }));
        expect(s2).toEqual({
          success: true,
          data: { name: "Witch from Mercury" },
        });

        await sleep(10);
        const s3 = await short.get("gundam", async () => ({
          success: true,
          data: { name: "Gundam SEED" },
        }));
        expect(s3).toEqual({ success: true, data: { name: "Gundam SEED" } });

        const l2 = await long.get("gundam", async () => ({
          success: true,
          data: { name: "Stardust Memory" },
        }));
        expect(l2).toEqual({
          success: true,
          data: { name: "The 08th MS Team" },
        });
      },
      { unsafeCleanup: true }
    );
  });

  it("supports complex values", async () => {
    await withDir(
      async ({ path }) => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
          quirks: z.array(z.string()),
        });
        const level = new Level(path);
        const db = new Cache(level, "complex", 1000, schema);

        const val = await db.get("kitty", async () => ({
          success: true,
          data: {
            name: "Proxima Nova",
            age: 3,
            quirks: ["spicy", "fluffy", "assertive"],
          },
        }));
        expect(val).toEqual({
          success: true,
          data: {
            name: "Proxima Nova",
            age: 3,
            quirks: ["spicy", "fluffy", "assertive"],
          },
        });
      },
      { unsafeCleanup: true }
    );
  });
});
