# Dockerfile untuk api-fahmyzzx
# Runtime: Python + Node.js + Chromium untuk puppeteer-real-browser
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production \
    DISPLAY=

WORKDIR /app

# System deps: chromium + nodejs + browser libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer cache
COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy worker package files first for Docker layer cache
COPY lib/services/worker/package*.json ./lib/services/worker/
RUN cd lib/services/worker && npm ci --omit=dev --legacy-peer-deps

# Copy all app files
COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default runtime env
ENV HOST=0.0.0.0 \
    PORT=9876 \
    GAI_WORKER_HOST=127.0.0.1 \
    GAI_WORKER_PORT=9879 \
    GAI_USE_PERSISTENT_WORKER=true \
    NODE_BIN=node \
    CHROME_BIN=/usr/bin/chromium

EXPOSE 9876

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9876/health', timeout=5).read()" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "9876"]
