# api-fahmyzzx - Portainer Deployment Guide

## Ringkas
Aplikasi ini jalan sebagai:
- `FastAPI` utama di port `9876`
- `Node.js worker` internal untuk Google AI Mode di port `9879`
- Data runtime disimpan ke volume Docker: `/app/data`

## Authentication
Semua endpoint penting wajib pakai header:
```http
Authorization: Bearer <PROVIDER_API_KEY>
```
Token ini diatur dari Environment Variable `PROVIDER_API_KEY` di Portainer.

## File yang aman di-upload ke GitHub
Upload:
```text
api-fahmyzzx/
├── api.py
├── Dockerfile
├── docker-compose.yml
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
Sekarang **cukup ini saja**:

```env
PROVIDER_API_KEY=isi_token_acak_kamu
MODEL_ID=google-ai-mode
```

## Setelah deploy: set runtime data via endpoint
### 1. Set Google cookies
```bash
curl -X POST http://127.0.0.1:9876/config/google/cookies \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"name":"SID","value":"..."}]'
```

### 2. Set Moodle session PKL
```bash
curl -X POST http://127.0.0.1:9876/config/moodle/session \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cookies_pkl_base64":"BASE64_HERE"}'
```

### 3. Validate Moodle session
```bash
curl -X POST http://127.0.0.1:9876/config/moodle/validate \
  -H "Authorization: Bearer $PROVIDER_API_KEY"
```

## Endpoint umum
### Health
```bash
curl http://127.0.0.1:9876/health
```

### Models
```bash
curl http://127.0.0.1:9876/v1/models \
  -H "Authorization: Bearer $PROVIDER_API_KEY"
```

### Chat
```bash
curl http://127.0.0.1:9876/v1/chat/completions \
  -H "Authorization: Bearer $PROVIDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google-ai-mode",
    "messages": [{"role": "user", "content": "Halo"}],
    "stream": false
  }'
```

## Portainer Stack
- Repo: private GitHub repo
- Compose path: `api-fahmyzzx/docker-compose.yml`
- Env: isi `PROVIDER_API_KEY`
- Setelah stack hidup, baru kirim cookies/session lewat endpoint `/config/*`

## Persistensi
- Cookies Google dan Moodle disimpan di volume Docker bernama:
  - `api_fahmyzzx_data`
- Jadi update cookies/session tidak hilang walau container restart.

## Swagger UI
- URL: `http://127.0.0.1:9876/docs`
- Semua endpoint selain `/health` butuh Bearer token
- Ada icon beruang 🐻
