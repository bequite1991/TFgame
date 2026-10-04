#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 《高塔防线》管理端 — 一键发布脚本
# 目标服务器：ubuntu@124.221.117.155（game.chujian.site）
#
# 用法：
#   ./deploy.sh                # 打包 → 上传 → 服务器构建 → 重启容器 → 验证
#
# 免密（二选一）：
#   1. 一次性配置 SSH 公钥：ssh-copy-id ubuntu@124.221.117.155（推荐，已配置）
#   2. export SRD_SSH_PASS='服务器密码'（需本地已装 sshpass）
#
# 注意：.env 不参与打包，服务器上的 /opt/srd-game/.env 不会被覆盖。
# ---------------------------------------------------------------------------
set -euo pipefail

SERVER="ubuntu@124.221.117.155"
APP_DIR=/opt/srd-game
IMAGE=srd-game
CONTAINER=srd-game
HOST_PORT=3300
DOMAIN=game.chujian.site

SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "${SRD_SSH_PASS:-}" ]; then
  SSH="sshpass -p $SRD_SSH_PASS ssh $SSH_OPTS"
  SCP="sshpass -p $SRD_SSH_PASS scp $SSH_OPTS"
else
  SSH="ssh $SSH_OPTS"
  SCP="scp $SSH_OPTS"
fi

echo "== 1/4 打包（排除 node_modules/.next/data/.env/系统元数据）=="
tar czf /tmp/srd-admin.tar.gz \
  --exclude=node_modules --exclude=.next --exclude=data \
  --exclude=.git --exclude=.env --exclude='*.log' \
  --exclude='._*' --exclude='.DS_Store' .

echo "== 2/4 上传到 $SERVER:$APP_DIR =="
$SSH "$SERVER" "sudo mkdir -p $APP_DIR && sudo chown ubuntu $APP_DIR"
$SCP /tmp/srd-admin.tar.gz "$SERVER:$APP_DIR/"

echo "== 3/4 服务器构建镜像并重启容器 =="
$SSH "$SERVER" "cd $APP_DIR \
  && tar xzf srd-admin.tar.gz && rm srd-admin.tar.gz \
  && mkdir -p $APP_DIR/data \
  && sudo docker build -t $IMAGE . \
  && (sudo docker rm -f $CONTAINER 2>/dev/null || true) \
  && sudo docker run -d --name $CONTAINER --restart unless-stopped \
       -p 127.0.0.1:$HOST_PORT:3000 \
       -v $APP_DIR/data:/app/data \
       --env-file $APP_DIR/.env \
       $IMAGE \
  && sudo chmod -R a+rX $APP_DIR/data \
  && sleep 4 \
  && curl -s -o /dev/null -w 'container http %{http_code}\n' http://127.0.0.1:$HOST_PORT/login"

echo "== 4/4 线上验证 =="
curl -s -o /dev/null -w "https://$DOMAIN    -> %{http_code}\n" "https://$DOMAIN/"
echo "发布完成 ✅"
