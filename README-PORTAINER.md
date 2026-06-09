# api-fahmyzzx - Portainer Deployment Guide

## Ringkas
Aplikasi ini jalan sebagai:
- `FastAPI` utama di port `9876`
- `Node.js worker` internal untuk Google AI Mode di port `9879`
- `Chromium` auto-discovery/auto-install di Linux container

## Authentication
Semua endpoint penting wajib pakai header:
```http
Authorization: Bearer <PROVIDER_API_KEY>
```
Token ini diatur dari Environment Variable `PROVIDER_API_KEY` di Portainer.

## File yang aman di-upload ke GitHub
Upload folder ini saja:
```text
api-fahmyzzx/
├── api.py
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
├── requirements.txt
├── README-DOCKER.md
├── README-PORTAINER.md
├── .dockerignore
├── .gitignore
├── .env.example
└── lib/
```

Jangan upload secret runtime:
- `.env`
- `cookies.json`
- `www.google.com.cookies.json`
- `moodle_uaa_cookies.pkl`
- `node_modules/`

## Environment Variables Portainer
Isi di Stack -> Environment Variables:

```env
PROVIDER_API_KEY=isi_token_acak_kamu
GOOGLE_COOKIES_JSON=[{"name":"...","value":"..."}]
MOODLE_UAA_COOKIES_PKL_B64=base64_dari_file_pkl_opsional
HOST=0.0.0.0
PORT=9876
GAI_WORKER_HOST=127.0.0.1
GAI_WORKER_PORT=9879
GAI_USE_PERSISTENT_WORKER=true
NODE_BIN=node
CHROME_BIN=/usr/bin/chromium
```

## Endpoint
### 1) Health
```bash
curl http://127.0.0.1:9876/health
```

### 2) Model list
```bash
curl http://127.0.0.1:9876/v1/models \
  -H "Authorization: Bearer $PROVIDER_API_KEY"
```

### 3) Chat completions
```bash
curl http://127.0.0.1:9876/v1/chat/completions \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google-ai-mode",
    "messages": [
      {"role": "user", "content": "Halo, jawab singkat"}
    ],
    "stream": false
  }'
```

### 4) Chat with image URL base64
```bash
curl http://127.0.0.1:9876/v1/chat/completions \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google-ai-mode",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Apa isi gambar ini?"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,...."}}
        ]
      }
    ],
    "stream": false
  }'
```

### 5) Save Google cookies
```bash
curl -X POST http://127.0.0.1:9876/config/google/cookies \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"name":"SID","value":"..."}]'
```

### 6) Save Moodle session (Base64 PKL)
```bash
curl -X POST http://127.0.0.1:9876/config/moodle/session \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cookies_pkl_base64":"BASE64_HERE"}'
```

### 7) Validate Moodle session
```bash
curl -X POST http://127.0.0.1:9876/config/moodle/validate \
  -H "Authorization: Bearer $PROVIDER_API_KEY"
```

## Portainer Stack
- Repo: private GitHub repo
- Compose path: `api-fahmyzzx/docker-compose.yml`
- Env: isi semua variable di atas
- Deploy: Portainer akan build image dan start service otomatis

## Swagger UI
- URL: `http://127.0.0.1:9876/docs`
- Favicon: beruang 🐻
- Semua endpoint penting sudah diberi security BearerAuth

## Catatan
- `PROVIDER_API_KEY` bebas kamu ganti dari Portainer.
- Kalau token kosong, API mode testing bisa jalan, tapi sebaiknya jangan untuk production.
- Worker Google AI start otomatis dari `api.py`.
- Kalau Linux container belum punya Chromium, API akan coba install dulu.
