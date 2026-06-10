# Bun Rewrite & Webview Migration Plan

## Phase 0: Audit & Preparation
- [x] Catat seluruh endpoint Python saat ini (golden fixtures):
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions` (OpenAI format)
  - `POST /v1/chat/file`
  - `GET /maps/place?q=`
  - `POST /config/google/cookies`
  - `POST /config/moodle/session`
  - `POST /config/moodle/validate`
  - `GET /api/tugas`
- [x] Buat dokumentasi format JSON asli dari setiap endpoint sebagai acuan `expect()` saat testing.

## Phase 1: Bun Server Skeleton
- [x] Inisialisasi project Bun (`bun init` atau pakai Elysia/Hono).
- [x] Buat global middleware untuk Bearer Token Auth (selain `/health`).
- [x] Buat routing dasar untuk semua endpoint di atas (return mock data sementara).

## Phase 2: Moodle Migration (Python to JS Fetch)
- [x] Buat script Python sekali pakai untuk convert `moodle_uaa_cookies.pkl` ke `moodle_cookies.json`.
- [x] Tulis ulang `MoodleSessionService` menggunakan native `fetch` API di Bun.
- [x] Tulis ulang `MoodleTasksService` (regex HTML parsing) ke native JS (Regex / Cheerio).
- [x] Integrasikan endpoint `/api/tugas`, `/config/moodle/session`, dan `/config/moodle/validate`.

## Phase 3: Experimental Bun Webview (Google AI)
- [x] Hapus dependensi `puppeteer-real-browser` dan Node.js.
- [x] Riset dan pasang library Webview untuk Bun (misal: binding GTK/WebKit untuk Linux, atau `webview-bun`).
- [x] Buat adapter/service `GaiWebviewProvider` untuk menggantikan `gai.mjs`.
  - [x] Fitur load cookie JSON ke Webview session.
  - [x] Mekanisme navigasi ke URL Google AI (`udm=50`).
  - [x] Eksekusi / inject JavaScript ke Webview untuk query selector (textarea, submit, scrap result).
  - [x] Mekanisme antrean (Queue / Singleton) karena Webview biasanya UI-bound thread.
- [x] Integrasikan `/v1/chat/completions`, `/v1/chat/file`, `/maps/place`, `/config/google/cookies` via placeholder IPC.

## Phase 4: Parity Test & Verification
- [x] Jalankan Bun health smoke test.
- [x] Jalankan `bunx tsc --noEmit`.
- [x] Tembak CURL dengan payload yang sama untuk semua endpoint.
- [x] Pastikan respons body Bun 100% identik dengan struktur JSON FastAPI lama (terutama format OpenAI).
- [x] Verifikasi error handling (status code 400, 401, 500, 502).

## Phase 5: Local Run & Cleanup
- [x] Buat runner scripts menggunakan Bun.
- [x] Hapus Dockerfile dan docker-compose.yml.
- [x] Bersihkan folder lama (Python requirements.txt, api.py, lib/ routes lama, lib/services lama).
- [x] Cutover: Bun ditaruh di port default 9876. Python API resmi dimatikan.
