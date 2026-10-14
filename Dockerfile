FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data CATALOG_DB=/data/catalog.sqlite
VOLUME /data
EXPOSE 8787
CMD ["sh","-c","node scripts/restore-catalog.mjs; exec npm start"]
