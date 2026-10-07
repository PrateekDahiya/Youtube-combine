FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists \
    && pip install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=5001
ENV MEDIA_DIR=/data/media

EXPOSE 5001
CMD ["node", "server.js"]
