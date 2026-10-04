FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com

COPY server.js ./

EXPOSE 3301
CMD ["node", "server.js"]
