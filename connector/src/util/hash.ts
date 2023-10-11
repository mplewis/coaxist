import { createHash } from "crypto";

import stringify from "json-stable-stringify";

/** Hash an object using SHA-256 into a short value. */
export function secureHash(x: Object): string {
  return createHash("sha256").update(stringify(x)).digest("base64").slice(0, 8);
}
