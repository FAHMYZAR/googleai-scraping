type QueueJob<T> = () => Promise<T>;

export class AsyncQueue {
  private active = 0;
  private readonly pending: Array<() => void> = [];

  constructor(private readonly concurrency = 1) {}

  async run<T>(job: QueueJob<T>): Promise<T> {
    await this.acquire();
    try {
      return await job();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.pending.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release() {
    this.active -= 1;
    const next = this.pending.shift();
    if (next) next();
  }
}
