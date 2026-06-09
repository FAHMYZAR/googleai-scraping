#!/bin/sh
set -e

# Tulis GOOGLE_COOKIES_JSON ke file jika ada
if [ -n "$GOOGLE_COOKIES_JSON" ]; then
    echo "Menulis cookies.json dari environment..."
    echo "$GOOGLE_COOKIES_JSON" > /app/cookies.json
fi

# Tulis MOODLE_UAA_COOKIES_PKL_B64 ke file pkl jika ada
if [ -n "$MOODLE_UAA_COOKIES_PKL_B64" ]; then
    echo "Menulis moodle_uaa_cookies.pkl dari environment..."
    echo "$MOODLE_UAA_COOKIES_PKL_B64" | base64 -d > /app/moodle_uaa_cookies.pkl
fi

# Panggil command asli (uvicorn)
exec "$@"
