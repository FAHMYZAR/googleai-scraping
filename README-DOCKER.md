# Deploy `api-fahmyzzx` ke Docker / Portainer

## File penting
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.gitignore`

## Persiapan
1. Pastikan file ini ada di folder yang sama:
   - `.env`
   - `cookies.json`
   - `moodle_uaa_cookies.pkl` (optional, hanya jika pakai endpoint `/api/tugas`)
2. Ubah `PROVIDER_API_KEY` di `.env` untuk produksi.

## Jalankan lokal dengan Docker Compose
```bash
docker compose up --build -d
```

Lalu cek:
- API health: `http://127.0.0.1:9876/health`
- Docs: `http://127.0.0.1:9876/docs`
- Models: `curl http://127.0.0.1:9876/v1/models -H "Authorization: Bearer <API_KEY>"`

## Deploy ke Portainer
### Opsi A: Build dari Git/Folder
- Upload seluruh folder `api-fahmyzzx`
- Gunakan `docker-compose.yml`
- Pastikan volume file `cookies.json` tersedia di host.

### Opsi B: Stack di Portainer
Copy isi `docker-compose.yml` ke Stack Portainer.
Lalu pastikan host path file:
- `./cookies.json`
- `./moodle_uaa_cookies.pkl` (optional)

## Catatan penting
- Worker Google AI otomatis start dari `api.py`, jadi tidak perlu service terpisah.
- Chromium terinstall di image Docker.
- Container expose port `9876`.
- Endpoint default:
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `POST /v1/chat/file`

## Contoh curl
```bash
curl http://127.0.0.1:9876/v1/chat/completions \
  -H "Authorization: Bearer sk-gai-local-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google-ai-mode",
    "messages": [{"role": "user", "content": "Halo"}],
    "stream": false
  }'
```
