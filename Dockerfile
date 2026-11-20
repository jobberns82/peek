FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=6001
WORKDIR /srv/peek
COPY VERSIE ./
COPY app ./app
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "app/server.js"]
