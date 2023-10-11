import { describe, expect, it } from "vitest";

import { retry } from "./retry";

describe("retry", () => {
  it("retries functions as expected", async () => {
    let attempt = 0;
    const result = await retry(
      "test fn",
      { maxAttempts: 5, initialDelayMs: 1 },
      async () => {
        attempt++;
        if (attempt < 3) {
          return {
            state: "retry",
            error: `attempt ${attempt}`,
          };
        }
        return { state: "done", data: "done" };
      }
    );

    expect(result).toEqual({
      success: true,
      data: "done",
      errors: ["attempt 1", "attempt 2"],
    });
  });

  it("does not retry on error", async () => {
    let attempts = 0;
    const result = await retry(
      "test fn",
      { maxAttempts: 5, initialDelayMs: 1 },
      async () => {
        attempts++;
        if (attempts < 3) return { state: "retry", error: "timeout" };
        return { state: "error", error: "unauthorized" };
      }
    );
    expect(result).toEqual({
      success: false,
      errors: ["timeout", "timeout", "unauthorized"],
    });
  });

  it("times out as expected", async () => {
    const result = await retry(
      "test fn",
      { maxDurationMs: 200, initialDelayMs: 1 },
      async () => ({ state: "retry", error: "timeout" })
    );

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(7); // 2^7 = 128
  });

  it("respects max attempts", async () => {
    const result = await retry(
      "test fn",
      { maxAttempts: 3, initialDelayMs: 1 },
      async () => ({ state: "retry", error: "timeout" })
    );

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(3);
  });

  it("supports the no-opts signature", async () => {
    const result = await retry("test fn", async () => ({
      state: "done",
      data: "ok",
    }));

    expect(result).toEqual({ success: true, data: "ok", errors: [] });
  });
});
