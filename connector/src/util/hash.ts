import stringify from "json-stable-stringify";
import { createHash } from "crypto";

export function secureHash(x: Object): string {
  return createHash("sha256").update(stringify(x)).digest("hex");
}
