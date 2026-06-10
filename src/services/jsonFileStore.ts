import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

export class JsonFileStore<T> {
  constructor(private readonly filePath: string, private readonly fallback: T) {}

  async read(): Promise<T> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return this.fallback;
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(value, null, 2), "utf-8");
  }
}
