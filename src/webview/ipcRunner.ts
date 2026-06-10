import { Webview } from "webview-bun";
import { readFileSync } from "node:fs";

const DONE_MARKERS = ["Respons Mode AI sudah siap", "AI Mode response is ready", "AI Mode response ready"];
const FAIL_MARKERS = ["Something went wrong and the content wasn't generated", "Terjadi error", "Something went wrong"];

function getMimeType(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

async function main() {
  const payloadFile = process.env.PAYLOAD_FILE || "";
  if (!payloadFile) {
    console.log(JSON.stringify({ ok: false, error: "PAYLOAD_FILE env is required" }));
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(payloadFile, "utf-8"));
  
  // Read google cookies if available
  let googleCookies = "[]";
  try {
    const rawEnvCookies = process.env.COOKIES_PATH || "data/cookies.json";
    googleCookies = readFileSync(rawEnvCookies, "utf-8");
  } catch {}

  const webview = new Webview(false, { width: 1024, height: 768, hint: 0 });

  // 1. Inject cookie setter script at page init
  const cookieScript = `
    (function() {
      try {
        const cookies = ${googleCookies};
        if (location.hostname.includes("google.com") && Array.isArray(cookies)) {
          for (const c of cookies) {
            const secure = c.secure !== false ? "; Secure" : "";
            const sameSite = c.sameSite ? "; SameSite=" + c.sameSite : "; SameSite=None";
            document.cookie = c.name + "=" + c.value + "; domain=" + (c.domain || ".google.com") + "; path=" + (c.path || "/") + secure + sameSite;
          }
        }
      } catch(e) {}
    })();
  `;
  webview.init(cookieScript);

  webview.bind("sendResponse", (payloadStr: string) => {
    console.log(payloadStr);
    webview.destroy();
    process.exit(0);
  });

  // 3. Webview logic
  if (payload.type === "chat") {
    const message = payload.message || "";
    const hl = process.env.GAI_LANG || "id";
    
    // Teks saja, langsung tembak URL
    const startUrl = `https://www.google.com/search?udm=50&aep=11&hl=${hl}&q=${encodeURIComponent(message)}`;

    const injectRunner = `
      (function() {
        const doneMarkers = ${JSON.stringify(DONE_MARKERS)};
        const failMarkers = ${JSON.stringify(FAIL_MARKERS)};
        let start = Date.now();

        function answerRoots() {
          for (const sel of ['[jsname="KFl8ub"]', '[data-container-id="main-col"]']) {
            const list = [...document.querySelectorAll(sel)].filter((e) => e.innerText && e.innerText.trim().length > 80);
            if (list.length) return list;
          }
          return [];
        }

        function cleanName(label) {
          let name = (label || '')
            .replace(/\\s*\\(\\+\\d+\\).*/, '')
            .replace(/\\s*-\\s*Lihat link terkait.*/i, '')
            .replace(/\\.\\s*Dibuka di tab baru\\.?.*/i, '')
            .replace(/\\.\\s*Opens in new tab\\.?.*/i, '')
            .trim();
          if (name.length > 90) name = name.slice(0, 90).trim() + '\\u2026';
          return name;
        }

        function inlineText(node) {
          let out = '';
          const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'BUTTON']);
          node.childNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) {
              out += n.textContent;
            } else if (n.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has(n.tagName)) {
              const tag = n.tagName;
              const inner = inlineText(n);
              if (tag === 'A' && n.href && !n.href.includes('google.com/search')) {
                out += inner.trim() ? '[' + inner.trim() + '](' + n.href + ')' : '';
              } else if (tag === 'STRONG' || tag === 'B') {
                out += inner.trim() ? '**' + inner.trim() + '**' : '';
              } else if (tag === 'EM' || tag === 'I') {
                out += inner.trim() ? '*' + inner.trim() + '*' : '';
              } else if (tag === 'BR') {
                out += '\\n';
              } else {
                out += inner;
              }
            }
          });
          return out;
        }

        function scrape() {
          const roots = answerRoots();
          const root = roots[roots.length - 1] || document.body;
          
          const blocks = [];
          const seen = new Set();
          function pushBlock(type, text, extra) {
            const clean = (text || '').replace(/[ \\t]+/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim();
            if (!clean) return;
            const key = type + '::' + clean;
            if (seen.has(key)) return;
            seen.add(key);
            blocks.push(Object.assign({ type, text: clean }, extra || {}));
          }

          root.childNodes.forEach((n) => {
            if (n.nodeType !== Node.ELEMENT_NODE || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
            pushBlock('paragraph', inlineText(n));
          });

          const answerText = blocks.map(b => b.text).join('\\n\\n');
          const citations = [];
          root.querySelectorAll('a[href^="http"]').forEach((a) => {
            if (a.href.includes('google.com')) return;
            const label = (a.innerText || a.getAttribute('aria-label') || '').trim();
            citations.push({ name: cleanName(label), url: a.href });
          });

          return {
            ok: true,
            text: answerText,
            markdown: answerText,
            sources: citations,
            error: null
          };
        }

        const interval = setInterval(() => {
          // Polling Jawaban
          const bodyText = document.body.innerText || "";
          const done = doneMarkers.some(m => bodyText.includes(m));
          const fail = failMarkers.some(m => bodyText.includes(m));

          if (done) {
            clearInterval(interval);
            window.sendResponse(JSON.stringify(scrape()));
          } else if (fail) {
            clearInterval(interval);
            window.sendResponse(JSON.stringify({ ok: false, error: "GAI model error detected on page" }));
          } else if (Date.now() - start > 45000) {
            clearInterval(interval);
            window.sendResponse(JSON.stringify({ ok: false, error: "Scrape timed out in Webview" }));
          }
        }, 500); // Polling lebih agresif (500ms dari 800ms) untuk kecepatan
      })();
    `;

    webview.init(injectRunner);
    webview.navigate(startUrl);
  } else if (payload.type === "place") {
    const q = payload.query || "";
    const startUrl = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;

    const injectMaps = `
      (function() {
        const start = Date.now();
        const interval = setInterval(() => {
          const url = window.location.href;
          const match = url.match(/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+),(\\d+)z/);
          if (match) {
            clearInterval(interval);
            window.sendResponse(JSON.stringify({
              ok: true,
              query: ${JSON.stringify(q)},
              title: document.title || ${JSON.stringify(q)},
              place: ${JSON.stringify(q)},
              latitude: parseFloat(match[1]),
              longitude: parseFloat(match[2]),
              zoom: parseInt(match[3]),
              place_id: "maps_resolved",
              final_url: url
            }));
          } else if (Date.now() - start > 15000) {
            clearInterval(interval);
            window.sendResponse(JSON.stringify({ ok: false, error: "Maps place not resolved in timeout" }));
          }
        }, 500);
      })();
    `;

    webview.init(injectMaps);
    webview.navigate(startUrl);
  } else {
    console.log(JSON.stringify({ ok: false, error: "unknown payload type" }));
    process.exit(1);
  }

  webview.run();
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
