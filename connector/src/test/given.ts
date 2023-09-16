import { beforeEach } from "vitest";

export class Given {
  values: Record<string, any> = {};

  get v() {
    return this.values;
  }

  given = (k: string, builder: () => any) =>
    beforeEach(() => {
      this.values[k] = builder();
    });
}
