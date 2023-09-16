import { afterEach, beforeEach } from "vitest";

export class Given {
  values: Record<string, any> = {};

  get v() {
    return this.values;
  }

  given = (k: string, builder: () => any) => {
    const last = this.values[k];
    beforeEach(() => {
      this.values[k] = builder();
    });
    afterEach(() => {
      this.values[k] = last;
    });
  };
}
