#!/usr/bin/env bash
# 上传炮塔 3D 素材到七牛云 honeystar 桶
# 目标：https://oss.chujian.site/srd-game/turrets/...（与 src/main.ts assetUrl 的路径改写一致）
#
# 前置：
#   brew install qshell
#   qshell account <AccessKey> <SecretKey> <账号名>   # 凭证只存在本地 ~/.qshell，不要提交
#
# 用法：tools/upload-turrets-cdn.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="$PWD/assets/turrets"
BUCKET="honeystar"
PREFIX="srd-game/turrets/"

if ! command -v qshell >/dev/null 2>&1; then
  echo "缺少 qshell，请先执行: brew install qshell" >&2
  exit 1
fi
if ! qshell user ls 2>/dev/null | grep -q .; then
  echo "qshell 未配置账号，请先执行: qshell account <AK> <SK> <账号名>" >&2
  exit 1
fi

# models/ 目录是 Blender 源文件，仅供本地编辑，不上 CDN
qshell qupload2 \
  --src-dir="$SRC_DIR" \
  --bucket="$BUCKET" \
  --key-prefix="$PREFIX" \
  --overwrite \
  --rescan-local \
  --skip-path-prefixes=models \
  --skip-file-prefixes=.DS_Store \
  --thread-count=4

echo "--- 验证线上可访问性 ---"
curl -s -o /dev/null -w 'frame_00: %{http_code}\n' "https://oss.chujian.site/srd-game/turrets/laser/frame_00.png"
curl -s -o /dev/null -w 'frame_23: %{http_code}\n' "https://oss.chujian.site/srd-game/turrets/laser/frame_23.png"
curl -s -o /dev/null -w 'hero:     %{http_code}\n' "https://oss.chujian.site/srd-game/turrets/laser/hero.png"
