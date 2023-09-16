import { afterEach, beforeEach } from "vitest";

export class Given<T extends Record<string, any>> {
  constructor(private values: T) {}

  get v() {
    return this.values;
  }

  given = (k: keyof T, builder: () => any) => {
    const last = this.values[k];
    beforeEach(() => {
      this.values[k] = builder();
    });
    afterEach(() => {
      this.values[k] = last;
    });
  };
}
