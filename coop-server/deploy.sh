#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 《高塔防线》联机房间服务 — 一键发布脚本
# 目标服务器：ubuntu@124.221.117.155（game.chujian.site）
#
# 用法：
#   ./deploy.sh                # 打包 → 上传 → 服务器后台构建 → 重启容器 → 验证
#
# 免密（二选一）：
#   1. 一次性配置 SSH 公钥：ssh-copy-id ubuntu@124.221.117.155（推荐，已配置）
#   2. export SRD_SSH_PASS='服务器密码'（需本地已装 sshpass）
#
# 说明：纯内存服务，无数据卷、无 .env；构建用 nohup 后台执行防 ssh 断开。
# ---------------------------------------------------------------------------
set -euo pipefail

SERVER="ubuntu@124.221.117.155"
APP_DIR=/opt/srd-coop
IMAGE=srd-coop
CONTAINER=srd-coop
HOST_PORT=3301
DOMAIN=game.chujian.site

SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "${SRD_SSH_PASS:-}" ]; then
  SSH="sshpass -p $SRD_SSH_PASS ssh $SSH_OPTS"
  SCP="sshpass -p $SRD_SSH_PASS scp $SSH_OPTS"
else
  SSH="ssh $SSH_OPTS"
  SCP="scp $SSH_OPTS"
fi

echo "== 1/5 打包（排除 node_modules/test/系统元数据）=="
tar czf /tmp/srd-coop.tar.gz \
  --exclude=node_modules --exclude=test \
  --exclude=.git --exclude='*.log' \
  --exclude='._*' --exclude='.DS_Store' .

echo "== 2/5 上传到 $SERVER:$APP_DIR =="
$SSH "$SERVER" "sudo mkdir -p $APP_DIR && sudo chown ubuntu $APP_DIR"
$SCP /tmp/srd-coop.tar.gz "$SERVER:$APP_DIR/"

echo "== 3/5 服务器后台构建镜像并重启容器（nohup 防断开）=="
$SSH "$SERVER" "cd $APP_DIR \
  && tar xzf srd-coop.tar.gz && rm srd-coop.tar.gz \
  && sudo rm -f /tmp/srd-coop-build.log \
  && nohup sudo sh -c '\
       docker build -t $IMAGE . \
       && (docker rm -f $CONTAINER 2>/dev/null || true) \
       && docker run -d --name $CONTAINER --restart unless-stopped \
            -p 127.0.0.1:$HOST_PORT:3301 \
            $IMAGE \
       && echo BUILD_OK || echo BUILD_FAIL' \
       > /tmp/srd-coop-build.log 2>&1 &"

echo "== 4/5 轮询构建结果 =="
for i in $(seq 1 90); do
  if $SSH "$SERVER" "sudo grep -q BUILD_OK /tmp/srd-coop-build.log 2>/dev/null"; then
    echo "构建成功"
    break
  fi
  if $SSH "$SERVER" "sudo grep -q BUILD_FAIL /tmp/srd-coop-build.log 2>/dev/null"; then
    echo "构建失败，日志如下：" >&2
    $SSH "$SERVER" "sudo tail -30 /tmp/srd-coop-build.log" >&2
    exit 1
  fi
  sleep 5
done

echo "== 5/5 验证 =="
$SSH "$SERVER" "sleep 2 && curl -s http://127.0.0.1:$HOST_PORT/health && echo \
  && sudo docker logs --tail 5 $CONTAINER"
curl -s -o /dev/null -w "https://$DOMAIN/ws 反代 -> %{http_code}（404=已到 coop-server，反代正常）\n" \
  "https://$DOMAIN/ws" || true
echo "发布完成 ✅"
