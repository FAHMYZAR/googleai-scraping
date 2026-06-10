# 🐻 API-FAHMYZZX (v1.0.0)

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev)

**Hono API Gateway on Bun + Bun Webview IPC** bypasses Google AI Mode limits and crawls Moodle.

---

## 🌐 Architecture

```text
 9Router / Client 
       │ (Authorization: Bearer <PROVIDER_API_KEY>)
       ▼
 ┌──────────────────────────────────────────────┐
 │ Bun/Hono Server (Port 9876)                  │
 └──────┬───────────────────────────────────────┘
        │
        ├──────► Moodle Service (Loads moodle_cookies.json via fetch)
        │
        └──────► [IPC Subprocess] ──► Bun Webview (Webview-Bun IPC)
```

---

## ⚡ Deployment & Running

1. **Define environment variables in `.env`:**
   ```env
   PROVIDER_API_KEY=your-custom-hacker-secret-token
   MODEL_ID=google-ai-mode
   PORT=9876
   ```
2. **Run Server:**
   ```bash
   bun run src/index.ts
   ```

---

## 🚀 Endpoint Quick Sheet

All requests require `-H "Authorization: Bearer <PROVIDER_API_KEY>"` (except `/health`).

### 1. Send Chat
```bash
curl -X POST http://127.0.0.1:9876/v1/chat/completions \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"google-ai-mode","messages":[{"role":"user","content":"Halo"}],"stream":false}'
```

### 2. Inject Google Cookies
```bash
curl -X POST http://127.0.0.1:9876/config/google/cookies \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '[{"name":"__Secure-1PSID","value":"cookie_value_here","domain":".google.com"}]'
```

### 3. Inject Moodle Cookies (Accepts Base64 encoded Python PKL format)
```bash
curl -X POST http://127.0.0.1:9876/config/moodle/session \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"cookies_pkl_base64":"BASE64_PKL_STRING_HERE"}'
```

### 4. Fetch Moodle Tasks
```bash
curl http://127.0.0.1:9876/api/tugas -H "Authorization: Bearer <KEY>"
```
