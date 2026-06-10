import { Hono } from "hono";
import { logger } from "hono/logger";
import { AppConfig } from "./core/config";
import { ConfigStore } from "./services/configStore";
import { MoodleCookieStore } from "./services/moodleCookieStore";
import { MoodleTasksService } from "./services/moodleTasks";
import { parsePickleBase64 } from "./services/pickleParser";
import { GaiProviderService } from "./services/gaiProvider";
import { MapsProviderService } from "./services/mapsProvider";
import { appendSources, buildPrompt } from "./utils/v1Helpers";

const app = new Hono();
const configStore = new ConfigStore();
const moodleCookieStore = new MoodleCookieStore();
const gaiService = new GaiProviderService();
const mapsService = new MapsProviderService();
app.use("*", logger());

app.get("/health", (c) => {
  return c.json({ success: true, service: "api-fahmyzzx", status: "ok" });
});

app.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return c.json({ detail: "Missing bearer token" }, 401);
  }

  const token = authHeader.substring(7).trim();
  const validToken = process.env.PROVIDER_API_KEY || "change-me-super-secret";
  
  if (token !== validToken) {
    return c.json({ detail: "Invalid API key" }, 401);
  }

  await next();
});

// Routes Skeleton
const v1 = new Hono();
v1.get("/models", (c) => {
  return c.json({
    object: "list",
    data: [{
      id: process.env.MODEL_ID || "google-ai-mode",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "api-fahmyzzx"
    }]
  });
});

v1.post("/chat/completions", async (c) => {
  const body = await c.req.json().catch(() => null) as { model?: string; messages?: Array<{ role: string; content: unknown }> } | null;
  if (!body?.messages || body.messages.length === 0) {
    return c.json({ detail: "messages kosong" }, 400);
  }

  const { prompt } = buildPrompt(body.messages);
  if (!prompt.trim()) {
    return c.json({ detail: "messages tidak mengandung text" }, 400);
  }

  try {
    const result = await gaiService.chat(prompt);
    if (!result.ok) {
      return c.json({ detail: result.error || "GAI provider error" }, 502);
    }

    let content = result.markdown || result.text || "";
    content = appendSources(content, result.sources || []);

    return c.json({
      id: `chatcmpl-${crypto.randomUUID().replace(/-/g, "")}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model || AppConfig.MODEL_ID,
      choices: [{
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop"
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  } catch (err: any) {
    return c.json({ detail: err.message }, 500);
  }
});

v1.post("/chat/file", async (c) => {
  return c.json({ detail: "file upload disabled" }, 501);
});

const maps = new Hono();
maps.get("/place", async (c) => {
  const q = c.req.query("q")?.trim() || "";
  if (!q) return c.json({ detail: "q is required" }, 400);
  try {
    const result = await mapsService.getPlace(q);
    return c.json({
      success: true,
      query: result.query,
      title: result.title,
      place: result.place,
      latitude: result.latitude,
      longitude: result.longitude,
      zoom: result.zoom,
      place_id: result.place_id,
      url: result.final_url,
    });
  } catch (err: any) {
    const message = String(err.message || err);
    const status = message.toLowerCase().includes("place not resolved") ? 404 : 502;
    return c.json({ detail: message }, status);
  }
});

const config = new Hono();
config.post("/google/cookies", async (c) => {
  try {
    const body = await c.req.json();
    let cookiesData = body;
    // Jika body dikirim sbg { "cookies": "[{...}]" }
    if (body.cookies && typeof body.cookies === "string") {
      cookiesData = JSON.parse(body.cookies);
    }
    await configStore.writeGoogleCookies(cookiesData);
    return c.json({ success: true, message: "Google cookies updated and worker reset triggered" });
  } catch (err: any) {
    return c.json({ detail: err.message }, 500);
  }
});
config.post("/moodle/session", async (c) => {
  try {
    const body = await c.req.json();
    const base64str = body.cookies_pkl_base64 || body.value || body.cookies || "";
    if (!base64str) return c.json({ detail: "Missing cookies_pkl_base64" }, 400);

    const cookies = await parsePickleBase64(base64str);
    await moodleCookieStore.write(cookies);
    return c.json({ success: true, message: "Moodle session PKL updated" });
  } catch (err: any) {
    return c.json({ detail: err.message }, 400);
  }
});
config.post("/moodle/validate", async (c) => {
  try {
    const svc = new MoodleTasksService();
    await svc.validateSession();
    return c.json({ success: true, message: "Session Moodle valid" });
  } catch (err: any) {
    return c.json({ success: false, message: err.message });
  }
});

const api = new Hono();
api.get("/tugas", async (c) => {
  try {
    const svc = new MoodleTasksService();
    const result = await svc.getAllTasks();
    return c.json(result);
  } catch (err: any) {
    return c.json({ detail: err.message }, 500);
  }
});

app.route("/v1", v1);
app.route("/maps", maps);
app.route("/config", config);
app.route("/api", api);

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 9876,
  fetch: app.fetch,
};
