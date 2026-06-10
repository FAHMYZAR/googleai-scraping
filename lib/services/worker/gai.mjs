

import fs from 'node:fs';
import { connect } from 'puppeteer-real-browser';
import { lookup } from 'mime-types';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DONE_MARKERS = ['Respons Mode AI sudah siap', 'AI Mode response is ready', 'AI Mode response ready'];

const FAIL_MARKERS = ["Something went wrong and the content wasn't generated", 'Terjadi error', 'Something went wrong'];
const INPUT_SELECTORS = ['textarea.ITIRGe', 'textarea[placeholder="Tanyakan apa saja"]', 'textarea[placeholder="Ask anything"]'];

async function clickButton(page, label) {
  return page.evaluate((lbl) => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === lbl && b.getBoundingClientRect().height > 0
    );
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
}

function scrapePage(opts) {
  opts = opts || {};
  const wantLatest = opts.latest !== false;

  /**
   * Cari container jawaban AI Mode di DOM.
   * @returns {Element[]}
   */
  function answerRoots() {
    for (const sel of ['[jsname="KFl8ub"]', '[data-container-id="main-col"]']) {
      const list = [...document.querySelectorAll(sel)].filter((e) => e.innerText && e.innerText.trim().length > 80);
      if (list.length) return list;
    }
    return [];
  }
  const roots = answerRoots();
  let root;
  if (roots.length) {
    root = wantLatest ? roots[roots.length - 1] : roots[0];
  } else {
    let best = null, bestLen = 0;
    document.querySelectorAll('div').forEach((d) => {
      const t = (d.innerText || '').length;
      if (t > 200 && t < document.body.innerText.length * 0.8 && t > bestLen) { bestLen = t; best = d; }
    });
    root = best || document.body;
  }
  const turnCount = roots.length;

  const TRAILING_MARKERS = [
    'Bagikan link publik', 'Share public link',
    'Respons baik', 'Respons buruk', 'Good response', 'Bad response',
    'Salinan percakapan ini', 'A copy of this conversation',
    'Google dapat menggunakan data akun',
  ];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'BUTTON']);
  const blocks = [];
  const seen = new Set();

  /**
   * Ambil teks inline dari node, termasuk format Markdown sederhana
   * (link, bold, italic).
   * @param {Node} node - Node DOM yang akan diekstrak.
   * @returns {string} Teks dengan format Markdown.
   */
  function inlineText(node) {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        out += n.textContent;
      } else if (n.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has(n.tagName)) {
        const tag = n.tagName;
        const inner = inlineText(n);
        if (tag === 'A' && n.href && !n.href.includes('google.com/search')) {
          out += inner.trim() ? `[${inner.trim()}](${n.href})` : '';
        } else if (tag === 'STRONG' || tag === 'B') {
          out += inner.trim() ? `**${inner.trim()}**` : '';
        } else if (tag === 'EM' || tag === 'I') {
          out += inner.trim() ? `*${inner.trim()}*` : '';
        } else if (tag === 'BR') {
          out += '\n';
        } else {
          out += inner;
        }
      }
    });
    return out;
  }

  /**
   * Push block konten ke array, skip duplikat.
   * @param {string} type - Tipe block (`paragraph`, `heading`, `list_item`, `table`).
   * @param {string} text - Isi teks.
   * @param {Object} [extra] - Properti tambahan (mis. `level`, `ordered`, `rows`).
   */
  function pushBlock(type, text, extra) {
    const clean = (text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return;
    const key = type + '::' + clean;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(Object.assign({ type, text: clean }, extra || {}));
  }

  /**
   * Walk DOM tree, ekstrak heading/list/table/paragraph.
   * @param {Node} node - Node DOM yang akan di-walk.
   */
  function walk(node) {
    node.childNodes.forEach((n) => {
      if (n.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(n.tagName)) return;
      const tag = n.tagName;
      if (/^H[1-6]$/.test(tag)) {
        pushBlock('heading', inlineText(n), { level: +tag[1] });
      } else if (tag === 'UL' || tag === 'OL') {
        n.querySelectorAll(':scope > li').forEach((li) => pushBlock('list_item', inlineText(li), { ordered: tag === 'OL' }));
      } else if (tag === 'TABLE') {
        const rows = [...n.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.innerText.trim()));
        if (rows.length) pushBlock('table', rows.map((r) => r.join(' | ')).join('\n'), { rows });
      } else if (tag === 'P') {
        pushBlock('paragraph', inlineText(n));
      } else {
        const hasBlockChild = n.querySelector('h1,h2,h3,h4,h5,h6,ul,ol,p,table,div');
        if (!hasBlockChild) pushBlock('paragraph', inlineText(n));
        else walk(n);
      }
    });
  }
  walk(root);

  let cut = blocks.length;
  for (let i = 0; i < blocks.length; i++) {
    if (TRAILING_MARKERS.some((m) => blocks[i].text.includes(m))) { cut = i; break; }
  }
  const NAV_NOISE = new Set(['Mode AI', 'Semua', 'Gambar', 'Video', 'Berita', 'Lainnya',
    'Hasil Telusur', 'AI Mode', 'All', 'Images', 'Videos', 'News', 'More',
    'Lewati ke konten utama', 'Skip to main content', 'Salin', 'Copy', 'Bagikan', 'Share']);
  const answerBlocks = blocks.slice(0, cut).filter((b) => {
    if (b.type !== 'paragraph') return true;
    if (NAV_NOISE.has(b.text)) return false;
    if (b.text.startsWith('Anda mengucapkan:') || b.text.startsWith('You said:')) return false;
    return true;
  });

  const answerMarkdown = answerBlocks.map((b) => {
    if (b.type === 'heading') return '#'.repeat(b.level || 2) + ' ' + b.text;
    if (b.type === 'list_item') return (b.ordered ? '1. ' : '- ') + b.text;
    return b.text;
  }).join('\n\n');

  /**
   * Bersihkan nama sumber dari noise (tambahan "+N", "Lihat link terkait", dll).
   * @param {string} label - Nama sumber mentah.
   * @returns {string} Nama sumber yang sudah dibersihkan.
   */
  function cleanName(label) {
    let name = (label || '')
      .replace(/\s*\(\+\d+\).*/, '')
      .replace(/\s*-\s*Lihat link terkait.*/i, '')
      .replace(/\.\s*Dibuka di tab baru\.?.*/i, '')
      .replace(/\.\s*Opens in new tab\.?.*/i, '')
      .trim();
    if (name.length > 90) name = name.slice(0, 90).trim() + '\u2026';
    return name;
  }
  const VIDEO_HOSTS = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com|facebook\.com\/.*\/videos)/i;
  const citations = [], videos = [];
  const citeSeen = new Set(), videoSeen = new Set();

  root.querySelectorAll('a[href^="http"]').forEach((a) => {
    if (a.href.includes('google.com')) return;
    const label = (a.innerText || a.getAttribute('aria-label') || '').trim();
    const url = a.href;
    if (VIDEO_HOSTS.test(url)) {
      if (videoSeen.has(url)) return;
      videoSeen.add(url);
      const thumb = a.querySelector('img')?.src || a.closest('div')?.querySelector('img[src*="tbn"]')?.src || null;
      const durMatch = (a.closest('div')?.innerText || '').match(/\b(\d{1,2}:\d{2}|\d+\s?m(?:in)?)\b/);
      let platform = 'web';
      if (/youtu/.test(url)) platform = 'youtube';
      else if (/vimeo/.test(url)) platform = 'vimeo';
      else if (/tiktok/.test(url)) platform = 'tiktok';
      else if (/facebook/.test(url)) platform = 'facebook';
      else if (/dailymotion/.test(url)) platform = 'dailymotion';
      videos.push({ title: cleanName(label) || null, url, thumbnail: thumb, duration: durMatch ? durMatch[1] : null, platform });
      return;
    }
    if (!label || citeSeen.has(url)) return;
    citeSeen.add(url);
    const plus = (label.match(/\(+(\d+)\)/) || [])[1];
    citations.push({ name: cleanName(label), url, extraSources: plus ? +plus : 0 });
  });

  const images = [];
  const imgSeen = new Set();
  root.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.src || '';
    if (!/^https?:\/\//.test(src)) return;
    if (/faviconV2|\/favicon|\/ogw\/|gstatic\.com\/.+\.(svg|gif)\b/i.test(src)) return;
    if (!/images\?q=tbn|googleusercontent|ggpht/i.test(src)) return;
    const r = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: 99 };
    if (r.width && r.width < 40) return;
    if (imgSeen.has(src)) return;
    imgSeen.add(src);
    const link = img.closest('a')?.href || null;
    images.push({ thumbnail: src, alt: (img.alt || '').trim() || null, link: link && !link.includes('google.com') ? link : null });
  });

  const refCount = (document.body.innerText.match(/(\d+)\s*situs/i) || [])[1];
  const references = citations.map((c) => ({ name: c.name, url: c.url }));

  const related = [];
  const relSeen = new Set();
  root.querySelectorAll('[role="listitem"], [data-q], .related-question-pair').forEach((e) => {
    const t = (e.innerText || '').trim();
    if (t && t.length < 160 && /\?$/.test(t) && !relSeen.has(t)) { relSeen.add(t); related.push(t); }
  });

  return {
    title: document.title,
    answerText: answerBlocks.map((b) => b.text).join('\n\n'),
    answerMarkdown,
    blocks: answerBlocks,
    citations,
    references,
    referencesCount: refCount ? +refCount : citations.length,
    media: { images, videos },
    related,
    turnCount,
    rawText: document.body.innerText,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Client Google AI
 *
 * Buka browser Chromium, inject cookie login Google, lalu scrape jawaban
 * AI Mode (`www.google.com/search?udm=50`).
 * Gatau carany?, Gabung Community kami untuk tanya-jawab: https://chat.whatsapp.com/IuNP0MclssOIBEgoRJSo88
 * 
 */
export class Gai {
  /**
   * @param {Object} [config] - Opsi konfigurasi.
   * @param {string|Array<Object>} [config.cookies='./cookies.json']
   *     Path file cookie (format Cookie-Editor JSON) atau array cookie
   *     langsung (format puppeteer).
   * @param {string} [config.hl='id'] - Kode bahasa (`id`, `en`, ...).
   * @param {number} [config.timeout=90000] - Timeout per attempt (ms).
   * @param {number} [config.retries=3] - Jumlah percobaan ulang otomatis.
   */
  constructor(config = {}) {
    /** @private */
    this._config = {
      cookies: config.cookies || new URL('./cookies.json', import.meta.url),
      hl: config.hl || 'id',
      timeout: config.timeout || 90000,
      retries: config.retries ?? 3,
    };
    /** @private */
    this._browser = null;
    /** @private */
    this._page = null;
    /** @private */
    this._inited = false;
    /** @private */
    this._started = false;
    /** @private */
    this._turns = 0;
  }

  /**
   * @typedef {Object} ChatResponse
   * @property {string} id - Conversation ID (`conv_1740000000`).
   *     Pakai id ini untuk {@link Gai#chat follow-up}.
   * @property {string|null} text - Jawaban sebagai teks polos.
   * @property {string|null} markdown - Jawaban dengan format Markdown
   *     (heading, bold, link, list).
   * @property {Array<{name:string, url:string}>} sources
   *     Daftar sumber referensi unik.
   * @property {Array<{url:string, alt:string|null}>} images
   *     Gambar thumbnail yang muncul di jawaban.
   * @property {Array<{title:string|null, url:string, thumbnail:string|null}>} videos
   *     Video yang muncul di jawaban.
   * @property {string|null} error - Pesan error, `null` jika sukses.
   */

  /**
   * Kirim pesan ke Google AI Mode.
   *
   * - **Tanpa `opts.id`** — buka thread baru (pertanyaan pertama).
   * - **Dengan `opts.id`** — follow-up di thread yang sama (konteks nyambung).
   * - **Dengan `opts.file`** — upload file (gambar/PDF) dulu, lalu kirim.
   *
   * @param {string} message - Pertanyaan atau prompt.
   * @param {Object} [opts] - Opsi tambahan.
   * @param {string} [opts.id] - Conversation ID dari `.chat()` sebelumnya.
   *     Biarkan kosong untuk pertanyaan pertama.
   * @param {string} [opts.file] - Path absolut ke file.
   *     Gambar: png, jpg, jpeg, gif, webp, bmp, avif.
   *     Dokumen: pdf, doc, docx, txt, csv, xls, xlsx, ppt, pptx.
   * @returns {Promise<ChatResponse>}
   *
   * @example
   * // Pertanyaan pertama (otomatis buka browser & halaman baru)
   * const a = await ai.chat('apa itu AI');
   *
   * @example
   * // Follow-up dengan id dari chat sebelumnya
   * const b = await ai.chat('jelasin lebih detail', { id: a.id });
   *
   * @example
   * // Upload file gambar + tanya
   * const c = await ai.chat('deskripsikan gambar ini', {
   *   file: '/path/foto.jpg',
   *   id: a.id
   * });
   */
  async chat(message, opts = {}) {
    if (!this._inited) await this._init();
    const convId = `conv_${Date.now()}`;

    try {
      let result;

      if (opts.file) {
        result = await this._uploadAndAsk(opts.file, message);
      } else if (opts.id) {
        result = await this._followUp(message);
      } else {
        result = await this._ask(message);
      }

      return {
        id: convId,
        text: result?.answerText || null,
        markdown: result?.answerMarkdown || null,
        sources: (result?.references || []).map((r) => ({ name: r.name, url: r.url })),
        images: (result?.media?.images || []).map((img) => ({ url: img.thumbnail, alt: img.alt })),
        videos: (result?.media?.videos || []).map((v) => ({ title: v.title, url: v.url, thumbnail: v.thumbnail })),
        error: null,
      };
    } catch (err) {
      return {
        id: convId,
        text: null,
        markdown: null,
        sources: [],
        images: [],
        videos: [],
        error: err.message,
      };
    }
  }

  /**
   * Tutup browser dan lepaskan resource.
   * Selalu panggil setelah selesai menggunakan instance.
   *
   * @returns {Promise<void>}
   *
   * @example
   * const ai = new Gai();
   * // ... pake ai.chat() ...
   * await ai.close();
   */
  async close() {
    if (this._browser) {
      await this._browser.close().catch(() => {});
      this._browser = null;
      this._page = null;
      this._inited = false;
      this._started = false;
    }
  }

  /**
   * Init browser + cookie.
   * Otomatis deteksi DISPLAY: ada → headed, tidak ada → headless baru.
   * @private
   * @returns {Promise<void>}
   */
  async _init() {
    const hasDisplay = !!process.env.DISPLAY;
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--lang=id-ID'],
        ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
      connectOption: { defaultViewport: null },
    });
    this._browser = browser;
    this._page = page;
    await sleep(2500); // Wait real-browser patch
    await page.setUserAgent(UA);

    const raw = this._config.cookies;
    const cookies = Array.isArray(raw) ? raw : JSON.parse(fs.readFileSync(raw, 'utf8'));
    const mapped = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.google.com',
      path: c.path || '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : c.sameSite === 'strict' ? 'Strict' : undefined,
      ...(c.expirationDate ? { expires: Math.floor(c.expirationDate) } : {}),
    }));
    await page.setCookie(...mapped);
    this._inited = true;
  }

  /**
   * Pastikan halaman AI Mode sudah terbuka.
   * Navigasi pertama ke `google.com/search?udm=50`.
   * @private
   * @returns {Promise<void>}
   */
  async _ensureSession() {
    if (this._started) return;
    const url = `https://www.google.com/search?udm=50&aep=11&hl=${this._config.hl}`;
    await this._page.goto(url, { waitUntil: 'domcontentloaded', timeout: this._config.timeout }).catch(() => {});
    await sleep(3000);
    this._started = true;
  }

  /**
   * Submit pertanyaan baru (navigasi ke URL hasil pencarian).
   * @private
   * @param {string} query - Pertanyaan.
   * @returns {Promise<ScrapeResult>}
   */
  async _ask(query) {
    await this._ensureSession();
    const url = `https://www.google.com/search?udm=50&aep=11&hl=${this._config.hl}&q=${encodeURIComponent(query)}`;
    for (let attempt = 1; attempt <= this._config.retries; attempt++) {
      if (attempt > 1) await sleep(2500 * attempt);
      await this._page.goto(url, { waitUntil: 'domcontentloaded', timeout: this._config.timeout }).catch(() => {});
      const state = await this._waitTurn(1);
      if (state === 'ok') {
        this._turns = await this._countTurns();
        return this._scrape();
      }
    }
    return this._scrape();
  }

  /**
   * Follow-up di thread yang sama (konteks nyambung).
   * Ketik di textarea + tekan Enter.
   * @private
   * @param {string} query - Pertanyaan lanjutan.
   * @returns {Promise<ScrapeResult>}
   * @throws {Error} Jika kotak input follow-up tidak ditemukan.
   */
  async _followUp(query) {
    await this._ensureSession();
    const before = await this._countTurns();
    for (let attempt = 1; attempt <= this._config.retries; attempt++) {
      if (!(await this._type(query))) throw new Error('Kotak input follow-up tidak ditemukan');
      const state = await this._waitTurn(before + 1);
      if (state === 'ok') {
        this._turns = await this._countTurns();
        return this._scrape();
      }
      console.error('[gai] followUp retry ' + attempt + '/' + this._config.retries);
      await sleep(2000 * attempt);
    }
    return this._scrape();
  }

  /**
   * Upload file + kirim pesan.
   * Buka menu "Input lain" → klik "Upload file" → inject file via
   * File API + DataTransfer → ketik query → klik Kirim.
   * @private
   * @param {string} filePath - Path absolut file.
   * @param {string} query - Pertanyaan.
   * @returns {Promise<ScrapeResult>}
   */
  async _uploadAndAsk(filePath, query) {
    await this._ensureSession();
    for (let attempt = 1; attempt <= this._config.retries; attempt++) {
      if (attempt > 1) await sleep(2500 * attempt);

      const ok = await this._uploadFile(filePath);
      if (!ok) { console.error('[gai] upload gagal ' + attempt + '/' + this._config.retries); continue; }

      await sleep(1500);

      if (query) {
        await this._page.evaluate((q) => {
          const t = document.querySelector('textarea');
          if (t) { t.focus(); t.value = q; t.dispatchEvent(new Event('input', { bubbles: true })); }
        }, query);
        await sleep(300);
      }

      const sent = await this._page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Kirim' && !b.disabled);
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!sent) { console.error('[gai] Kirim disabled ' + attempt + '/' + this._config.retries); continue; }

      const state = await this._waitTurn(this._turns + 1);
      if (state === 'ok') {
        this._turns = await this._countTurns();
        return this._scrape();
      }
    }
    return this._scrape();
  }

  /**
   * Upload file ke halaman AI Mode via File API.
   * Buka menu → klik "Upload file" (menerima semua format: gambar, PDF, dokumen)
   * → baca file → konversi ke data URL → inject ke hidden `<input type="file">`
   * via DataTransfer + dispatch event.
   * @private
   * @param {string} filePath - Path absolut file.
   * @returns {Promise<boolean>} `true` jika berhasil.
   */
  async _uploadFile(filePath) {
    await clickButton(this._page, 'Input lain');
    await sleep(800);
    await clickButton(this._page, 'Upload file');
    await sleep(500);

    const buf = fs.readFileSync(filePath);
    const ext = filePath.split('.').pop().toLowerCase();
  
    const mime = lookup(filePath) || 'application/' + ext;
    const b64 = buf.toString('base64');
    const dataUrl = 'data:' + mime + ';base64,' + b64;
    const fileName = filePath.split('/').pop();

    return this._page.evaluate(async (url, name, mimeType) => {
      const fi = document.querySelector('input[type="file"]');
      if (!fi) return false;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: mimeType });
      const dt = new DataTransfer();
      dt.items.add(file);
      fi.files = dt.files;
      fi.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, dataUrl, fileName, mime);
  }

  /**
   * Hitung jumlah turn jawaban yang ada di halaman.
   * @private
   * @returns {Promise<number>}
   */
  async _countTurns() {
    return this._page.evaluate(() => {
      for (const sel of ['[jsname="KFl8ub"]', '[data-container-id="main-col"]']) {
        const n = [...document.querySelectorAll(sel)].filter((e) => (e.innerText || '').trim().length > 80).length;
        if (n) return n;
      }
      return 0;
    });
  }

  /**
   * Ketik teks di textarea follow-up lalu tekan Enter.
   * Cari textarea visible → click → type → Enter.
   * @private
   * @param {string} query - Teks yang akan diketik.
   * @returns {Promise<boolean>} `true` jika berhasil.
   */
  async _type(query) {
    const sel = await this._page.evaluate((sels) => {
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && el.getBoundingClientRect().height > 0) return s;
      }
      const els = [...document.querySelectorAll('textarea')].filter((e) => e.getBoundingClientRect().height > 0);
      if (els.length) {
        els.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y);
        els[0].id = els[0].id || 'gai-followup-input';
        return '#' + els[0].id;
      }
      return null;
    }, INPUT_SELECTORS);
    if (!sel) return false;
    const h = await this._page.$(sel);
    if (!h) return false;
    await h.click({ clickCount: 3 }).catch(() => {});
    await this._page.keyboard.type(query, { delay: 25 });
    await sleep(300);
    await this._page.keyboard.press('Enter');
    return true;
  }

  /**
   * Polling sampai jawaban AI selesai di-stream.
   * Cek turnCount, panjang teks, dan marker selesai.
   * @private
   * @param {number} expect - Jumlah turn yang diharapkan.
   * @returns {Promise<'ok'|'fail'|'timeout'>}
   */
  async _waitTurn(expect) {
    const start = Date.now();
    const budget = Math.min(this._config.timeout, 45000);
    let lastLen = -1, stable = 0;
    while (Date.now() - start < budget) {
      const s = await this._page.evaluate((m) => {
        let roots = [];
        for (const sel of ['[jsname="KFl8ub"]', '[data-container-id="main-col"]']) {
          const l = [...document.querySelectorAll(sel)].filter((e) => (e.innerText || '').trim().length > 80);
          if (l.length) { roots = l; break; }
        }
        const last = roots[roots.length - 1];
        const lastTxt = last ? last.innerText : '';
        const body = document.body.innerText || '';
        return {
          turns: roots.length,
          len: lastTxt.length,
          done: m.done.some((x) => body.includes(x)),
          failInLast: m.fail.some((x) => lastTxt.includes(x)),
          bodyFail: m.fail.some((x) => body.includes(x)),
        };
      }, { done: DONE_MARKERS, fail: FAIL_MARKERS });

      if (s.turns >= expect) {
        if (s.failInLast) return 'fail';
        if (s.done && s.len > 200) { await sleep(800); return 'ok'; }
        if (s.len === lastLen && s.len > 200) { if (++stable >= 7) return 'ok'; }
        else { stable = 0; lastLen = s.len; }
      } else if (s.bodyFail && Date.now() - start > 6000) {
        return 'fail';
      }
      await sleep(500);
    }
    return 'timeout';
  }

  /**
   * Jalankan ekstraktor DOM dan kembalikan data terstruktur.
   * @private
   * @returns {Promise<ScrapeResult>}
   */
  async _scrape() {
    return this._page.evaluate(scrapePage, { latest: true });
  }
}

export default Gai;


