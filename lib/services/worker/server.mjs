import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Gai } from './gai.mjs';

const app = express();
app.use(express.json({ limit: '10mb' })); // support large payloads for potential future expansions

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '../../..');

const PORT = Number(process.env.GAI_WORKER_PORT || 9879);
const HOST = process.env.GAI_WORKER_HOST || '127.0.0.1';
const rawCookies = process.env.COOKIES_PATH || 'cookies.json';
const COOKIES = path.isAbsolute(rawCookies) ? rawCookies : path.resolve(APP_DIR, rawCookies);
const HL = process.env.GAI_LANG || 'id';
const TIMEOUT = Number(process.env.GAI_TIMEOUT || 90000);

let ai = null;
let booting = null;

async function getAi() {
  if (ai) return ai;
  if (!booting) {
    booting = (async () => {
      ai = new Gai({ hl: HL, cookies: COOKIES, timeout: TIMEOUT, retries: 2 });
      return ai;
    })();
  }
  return booting;
}

app.get('/health', async (_req, res) => {
  try {
    await getAi();
    res.json({ success: true, status: 'ok', worker: 'gai', persistent: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const message = (req.body?.message || '').trim();
    const filePath = req.body?.file || null; // absolute path to temp image
    if (!message && !filePath) {
      return res.status(400).json({ ok: false, error: 'message or file is required' });
    }

    const client = await getAi();
    const result = await client.chat(message, filePath ? { file: filePath } : {});
    return res.json({
      ok: !result.error,
      text: result.text,
      markdown: result.markdown,
      sources: result.sources || [],
      images: result.images || [],
      videos: result.videos || [],
      error: result.error || null
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

app.post('/reset', async (_req, res) => {
  try {
    if (ai) {
      await ai.close().catch(() => {});
      ai = null;
      booting = null;
    }
    await getAi();
    res.json({ success: true, reset: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ ok: true, server: 'gai-worker', host: HOST, port: PORT }));
});

async function shutdown() {
  try {
    if (ai) await ai.close().catch(() => {});
  } finally {
    server.close(() => process.exit(0));
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
