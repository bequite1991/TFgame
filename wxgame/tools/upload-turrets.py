#!/usr/bin/env python3
"""上传单位 3D 素材到七牛云 honeystar 桶（零依赖，标准库实现表单上传）

目标：https://oss.chujian.site/srd-game/<prefix>/...（与 src/main.ts assetUrl 的路径改写一致）

用法：
  export QINIU_AK=<AccessKey>
  export QINIU_SK=<SecretKey>
  python3 tools/upload-turrets.py                                  # 原版炮塔（默认，兼容旧用法）
  python3 tools/upload-turrets.py --src turrets-h --prefix turrets-h/   # 恐怖版炮塔
  python3 tools/upload-turrets.py --src enemies-h --prefix enemies-h/   # 恐怖版敌人
  python3 tools/upload-turrets.py --src enemies --prefix enemies/       # 原版敌人（含 miniboss）

凭证仅从环境变量读取，不要写进任何会被提交的文件。
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.request
import uuid

BUCKET = 'honeystar'
UPLOAD_HOST = 'https://up.qiniup.com'
SKIP_DIRS = {'models', 'walk', 'split'}  # Blender 源文件与散帧仅供本地，CDN 只要 sheet.png/hero.png
SKIP_FILES = {'.DS_Store'}

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

ap = argparse.ArgumentParser()
ap.add_argument('--src', default='turrets', help='assets/ 下的源目录（默认 turrets）')
ap.add_argument('--prefix', default=None, help='CDN 前缀（缺省 = <src>/）')
args = ap.parse_args()
SRC = os.path.join(ROOT, 'assets', args.src)
PREFIX = f'srd-game/{args.prefix if args.prefix is not None else args.src + "/"}'

AK = os.environ.get('QINIU_AK', '').strip()
SK = os.environ.get('QINIU_SK', '').strip()
if not AK or not SK:
    sys.exit('缺少凭证：请先 export QINIU_AK / QINIU_SK（七牛控制台 → 密钥管理）')


def upload_token(key: str) -> str:
    policy = {'scope': f'{BUCKET}:{key}', 'deadline': int(time.time()) + 3600}
    encoded = base64.urlsafe_b64encode(json.dumps(policy).encode()).decode()
    sign = hmac.new(SK.encode(), encoded.encode(), hashlib.sha1).digest()
    return f'{AK}:{base64.urlsafe_b64encode(sign).decode()}:{encoded}'


def upload(path: str, key: str) -> None:
    boundary = uuid.uuid4().hex
    with open(path, 'rb') as f:
        data = f.read()
    parts = []
    for name, value in [('key', key), ('token', upload_token(key))]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(path)}"\r\n'
                 f'Content-Type: application/octet-stream\r\n\r\n'.encode() + data + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    body = b''.join(parts)
    req = urllib.request.Request(UPLOAD_HOST, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}',
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
        if result.get('key') != key:
            raise RuntimeError(f'返回异常: {result}')


def main() -> None:
    files = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(filenames):
            if fn in SKIP_FILES:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, SRC).replace(os.sep, '/')
            files.append((full, PREFIX + rel))
    print(f'共 {len(files)} 个文件待上传到 {BUCKET}:{PREFIX}')
    ok = 0
    for full, key in files:
        try:
            upload(full, key)
            ok += 1
            print(f'  ✓ {key} ({os.path.getsize(full) // 1024}KB)')
        except Exception as e:
            print(f'  ✗ {key}: {e}', file=sys.stderr)
    print(f'完成 {ok}/{len(files)}')
    if ok != len(files):
        sys.exit(1)


if __name__ == '__main__':
    main()
