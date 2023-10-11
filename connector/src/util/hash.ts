import { createHash } from "crypto";

import stringify from "json-stable-stringify";

export function secureHash(x: Object): string {
  return createHash("sha256").update(stringify(x)).digest("base64").slice(0, 8);
}
