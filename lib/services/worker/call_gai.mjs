// Override console.log & console.error untuk memisahkan log library dan JSON output
const originalLog = console.log;
const originalError = console.error;
const logs = [];
console.log = function(...args) {
  const str = args.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ');
  if (str.startsWith('{"ok":') || str.startsWith('{"success":') || str.startsWith('{"error":')) {
    originalLog(str);
  } else {
    originalError('[worker-log]', ...args);
  }
};
console.error = function(...args) {
  originalError('[worker-err]', ...args);
};
import { Gai } from './gai.mjs';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (err) { reject(err); }
    });
    process.stdin.on('error', reject);
  });
}

async function main() {
  const input = await readStdin();
  const message = input.message || '';
  const cookies = input.cookies || './cookies.json';
  const hl = input.hl || 'id';
  const timeout = input.timeout || 90000;

  if (!message.trim()) {
    console.log(JSON.stringify({ ok: false, error: 'message is required' }));
    return;
  }

  const ai = new Gai({ hl, cookies, timeout, retries: 2 });
  try {
    const result = await ai.chat(message);
    console.log(JSON.stringify({
      ok: !result.error,
      text: result.text,
      markdown: result.markdown,
      sources: result.sources || [],
      images: result.images || [],
      videos: result.videos || [],
      error: result.error || null
    }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err.message || String(err) }));
  } finally {
    await ai.close().catch(() => {});
  }
}
main();
