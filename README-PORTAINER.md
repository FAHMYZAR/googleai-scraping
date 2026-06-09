# Deploy Portainer Langsung dari GitHub Repo (Private)

Mode ini didesain 100% aman untuk GitHub private repository. Kamu **TIDAK PERLU** nge-push credentials (`.env`, `cookies.json`, atau file `.pkl`) ke repo. Semua *secret* diinject langsung dari UI Portainer sebagai *Environment Variables*.

## Daftar File yang Boleh & Wajib Masuk GitHub:
Pastikan `.gitignore` tetap seperti aslinya. File yang akan ke-push:
```text
api-fahmyzzx/
├── lib/                     # Folder source code
├── api.py                   # Script main FastAPI
├── requirements.txt         # Dependencies Python
├── Dockerfile               # Spesifikasi image build
├── docker-compose.yml       # Stack configuration
├── entrypoint.sh            # Script ekstraksi env to file
├── .dockerignore            # Aturan ignore image
├── .gitignore               # Aturan ignore repo
└── .env.example             # Contoh template environment
```

File yang otomatis ke-block oleh git (jangan di-force add):
- `cookies.json`
- `.env`
- `moodle_uaa_cookies.pkl`
- `node_modules`

## Cara Setup di Portainer

1. Masuk ke Portainer -> **Stacks** -> **Add stack**
2. Pilih metode **Repository** (Bukan Web editor).
3. Masukkan info repo private kamu:
   - **Repository URL**: `https://github.com/fahmyzzx/repo-kamu.git`
   - **Repository reference**: `main` (atau branch kamu)
   - **Compose path**: `api-fahmyzzx/docker-compose.yml` (sesuaikan kalau folder berbeda)
   - **Authentication**: Aktifkan dan masukkan username + Access Token GitHub.

4. Scroll ke bawah ke bagian **Environment variables**, klik **Add environment variable**. Tambahkan ini:

| Name | Value | Penjelasan |
|---|---|---|
| `PROVIDER_API_KEY` | `rahasia_api_key_ku` | Password untuk hit endpoint `/v1/*` ini. |
| `GOOGLE_COOKIES_JSON` | `[{"domain":".google.com",...}]` | Copy isi `cookies.json` kamu ke sini (1 baris string utuh). |
| `MOODLE_UAA_COOKIES_PKL_B64` | `gAN9cQAoWAEAA...` | (Opsional) Kalau mau pakai API Moodle tugas. Cara dapatnya: `cat moodle_uaa_cookies.pkl | base64 -w 0`. |

5. Klik tombol **Deploy the stack**.
6. Portainer akan mengunduh source, build Dockerfile (sekitar 3-5 menit karena install Node.js+Chrome), mengekstrak env menjadi file asli lewat `entrypoint.sh`, lalu me-run uvicorn API.

Selesai. Endpoint AI Mode siap dipakai di port *9876*!
