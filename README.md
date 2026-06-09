# 🐻 API-FAHMYZZX (v1.0.0)

```text
 💀 ======================================================= 💀
    ___    ____  ____       ______ ___   __  ____  ____ ___  _  __
   /   |  / __ \/  _/      / ____//   | /  |/  / |/ /_  |__ / |/ /
  / /| | / /_/ // /______ / /_   / /| |/ /|_/ /|    / / / / /|   / 
 / ___ |/ ____// /______/ __/   / ___ / /  / //    / / /_/__/   |  
/_/  |_/_/    /___/    /_/     /_/  |_/_/  /_//_/|_/ /___/ /_/|_|  
                                                                   
 💀 ============================== SECURED WITH BEARER ================= 💀
```

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)](https://pptr.dev)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)

**FastAPI Gateway + Persistent Puppeteer Worker** bypasses Google AI Mode limits and crawls Moodle.

---

## 🌐 Architecture

```text
 9Router / Client 
       │ (Authorization: Bearer <PROVIDER_API_KEY>)
       ▼
 ┌──────────────────────────────────────────────┐
 │ FastAPI (Port 9876)                          │ <── /docs (Favicon: 🐻)
 └──────┬───────────────────────────────────────┘
        │
        ├──────► Moodle Service (Loads moodle_uaa_cookies.pkl)
        │
        └──────► [HTTP IPC] ──► Node.js Worker (Port 9879)
                                    └── Puppeteer (Persistent Chrome Headless)
```

---

## ⚡ Deployment (Portainer / Docker)

1. **Copy `docker-compose.yml` to Portainer Stack.**
2. **Define environment variables:**
   ```env
   PROVIDER_API_KEY=your-custom-hacker-secret-token
   MODEL_ID=google-ai-mode
   ```
3. **Deploy Stack.**

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

### 3. Inject Moodle Cookies
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

---

## 📂 Git Upload Files
```text
api-fahmyzzx/
├── lib/
│   ├── core/      # Config, Router loader, Auth
│   ├── routes/    # Endpoint handlers (v1, config, tasks)
│   └── services/  # GAI and Moodle logic
├── api.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .dockerignore
└── .gitignore
```
