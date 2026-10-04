# ---------- 构建 ----------
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
# npm 偶发 "Exit handler never called" 自身崩溃且退出码仍为 0，
# 先升级 npm，再以 .bin/next 是否存在校验安装完整性并重试
RUN npm config set registry https://registry.npmmirror.com && \
    npm i -g npm@11 --no-audit --no-fund && \
    for i in 1 2 3 4 5; do \
      npm ci --no-audit --no-fund || true; \
      if [ -x node_modules/.bin/next ]; then break; fi; \
      echo "install incomplete, retry $i"; sleep 5; \
    done; \
    test -x node_modules/.bin/next

COPY . .
RUN npm run build

# ---------- 运行 ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# 容器默认 UTC，强制北京时间
ENV TZ=Asia/Shanghai

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 本项目无 public/ 目录，无需拷贝静态资产

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "server.js"]
