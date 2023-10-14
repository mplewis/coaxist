/** Sleep for the given duration. */
export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });
}
