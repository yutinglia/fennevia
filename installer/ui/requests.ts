// SPDX-License-Identifier: MPL-2.0
/** Ignore late results after cancellation, target changes, or component disposal. */
export class Requests {
  private generation = 0;
  busy = false;
  cancel() {
    this.generation++;
    this.busy = false;
  }
  async run<T>(
    work: () => Promise<T>,
    commit: (value: T) => void,
    reject: (code: string) => void,
  ) {
    if (this.busy) return;
    const current = ++this.generation;
    this.busy = true;
    try {
      const value = await work();
      if (current === this.generation) commit(value);
    } catch (error) {
      if (current === this.generation)
        reject(
          typeof error === "string" && /^[A-Z_]{1,64}$/.test(error)
            ? error
            : "UNEXPECTED",
        );
    } finally {
      if (current === this.generation) this.busy = false;
    }
  }
}
