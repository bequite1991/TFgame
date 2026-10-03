// 会话 token 签发与校验：base64url(payload) + '.' + base64url(HMAC-SHA256)
// 生产环境必须通过 SESSION_SECRET 配置独立密钥；缺省值仅供本地开发
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'srd-dev-secret';
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000; // 会话有效期 30 天

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(payload: string): Buffer {
  return crypto.createHmac('sha256', SECRET).update(payload).digest();
}

/** 签发会话 token：载荷为 { openid, exp }（exp 毫秒时间戳） */
export function signToken(openid: string): string {
  const payload = b64url(JSON.stringify({ openid, exp: Date.now() + TOKEN_TTL_MS }));
  return `${payload}.${b64url(hmac(payload))}`;
}

/** 从 Authorization: Bearer xxx 解析并验签 + 验过期，失败返回 null */
export function verifyToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(\S+)$/.exec(authHeader.trim());
  if (!m) return null;

  const dot = m[1].indexOf('.');
  if (dot <= 0) return null;
  const payload = m[1].slice(0, dot);
  const sig = m[1].slice(dot + 1);

  const expect = hmac(payload);
  let got: Buffer;
  try {
    got = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  // 时序安全比较防侧信道
  if (got.length !== expect.length || !crypto.timingSafeEqual(got, expect)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      openid?: unknown;
      exp?: unknown;
    };
    if (typeof data.openid !== 'string' || !data.openid) return null;
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data.openid;
  } catch {
    return null;
  }
}
