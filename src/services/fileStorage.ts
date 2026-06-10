import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { AppConfig } from "../core/config";

export class FileStorage {
  async writeTemp(buffer: ArrayBuffer | Uint8Array, suffix = ".tmp"): Promise<string> {
    await mkdir(AppConfig.DATA_DIR, { recursive: true });
    const path = join(AppConfig.DATA_DIR, `upload-${crypto.randomUUID()}${suffix}`);
    const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    await writeFile(path, Buffer.from(view));
    return path;
  }

  async remove(path: string | null | undefined): Promise<void> {
    if (!path) return;
    await unlink(path).catch(() => {});
  }
}
