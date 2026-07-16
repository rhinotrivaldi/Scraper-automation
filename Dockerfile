FROM node:22-slim

# Chromium sistem untuk Puppeteer (bundled Chrome tidak jalan di image minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pakai Chromium sistem, skip download Chrome bawaan (~170MB)
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3002

# ponytail: pm2 dihapus — restart ditangani docker (--restart unless-stopped)
CMD ["node", "app.js"]
