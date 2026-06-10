import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import { AppConfig } from "../core/config";
import type { BrowserWorker, WorkerChatResult, WorkerPlaceResult } from "./browserWorker";
import { AsyncQueue } from "./asyncQueue";

export class GaiWebviewProvider implements BrowserWorker {
  private readonly queue = new AsyncQueue(1);

  async health(): Promise<Record<string, unknown>> {
    return {
      success: true,
      status: "ok",
      worker: "bun-webview",
      persistent: true,
      experimental: true,
    };
  }

  private async runIpc(payload: Record<string, unknown>): Promise<any> {
    const tempFile = join(AppConfig.DATA_DIR, `ipc-${crypto.randomUUID()}.json`);
    writeFileSync(tempFile, JSON.stringify(payload));

    try {
      const proc = Bun.spawn(["bun", "run", join(process.cwd(), "src/webview/ipcRunner.ts")], {
        env: {
          ...process.env,
          PAYLOAD_FILE: tempFile,
        },
        stdout: "pipe",
        stderr: "inherit",
      });

      const stdoutText = await new Response(proc.stdout).text();
      await proc.exited;

      try {
        return JSON.parse(stdoutText.trim());
      } catch {
        throw new Error(`Webview returned invalid JSON: ${stdoutText}`);
      }
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  }

  async chat(message: string): Promise<WorkerChatResult> {
    return this.queue.run(async () => {
      return this.withTimeout(async () => {
        const prompt = message.trim();
        if (!prompt) {
          return { ok: false, error: "message is required" };
        }

        const res = await this.runIpc({ type: "chat", message: prompt });
        return {
          ok: res.ok,
          text: res.text,
          markdown: res.markdown || res.text,
          sources: res.sources || [],
          images: res.images || [],
          videos: res.videos || [],
          error: res.error || null,
        };
      });
    });
  }

  async place(query: string): Promise<WorkerPlaceResult> {
    return this.queue.run(async () => {
      return this.withTimeout(async () => {
        const value = query.trim();
        if (!value) {
          throw new Error("place not resolved");
        }

        const res = await this.runIpc({ type: "place", query: value });
        if (!res.ok) {
          throw new Error(res.error || "place not resolved");
        }

        return {
          query: value,
          title: res.title || null,
          place: res.place || null,
          latitude: res.latitude || null,
          longitude: res.longitude || null,
          zoom: res.zoom || null,
          place_id: res.place_id || null,
          final_url: res.final_url || null,
        };
      });
    });
  }

  async reset(): Promise<{ success: boolean; reset: boolean }> {
    return { success: true, reset: true };
  }

  private async withTimeout<T>(job: () => Promise<T>): Promise<T> {
    return await Promise.race([
      job(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${AppConfig.GAI_TIMEOUT}ms`)), AppConfig.GAI_TIMEOUT);
      }),
    ]);
  }
}
