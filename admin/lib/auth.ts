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

/* ---------- 管理端会话 cookie（与游戏端 token 同构，过期 12h） ---------- */

import type { AdminRole } from './admins';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'srd_admin';
export const ADMIN_SESSION_TTL_S = 12 * 3600; // 会话 12 小时

export interface AdminSession {
  email: string;
  role: AdminRole;
}

const ROLE_LEVEL: Record<AdminRole, number> = { readonly: 0, ops: 1, super: 2 };
const VALID_ROLES = new Set<AdminRole>(['readonly', 'ops', 'super']);

/** 通用载荷验签（供游戏端 token 与管理端会话复用） */
function verifyPayload<T>(token: string, check: (data: Record<string, unknown>) => T | null): T | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expect = hmac(payload);
  let got: Buffer;
  try {
    got = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (got.length !== expect.length || !crypto.timingSafeEqual(got, expect)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return check(data);
  } catch {
    return null;
  }
}

/** 签发管理端会话 token：载荷为 { email, role, exp } */
export function signAdminSession(email: string, role: AdminRole): string {
  const payload = b64url(JSON.stringify({ email, role, exp: Date.now() + ADMIN_SESSION_TTL_S * 1000 }));
  return `${payload}.${b64url(hmac(payload))}`;
}

/** 验签管理端会话 token，失败/过期返回 null */
export function verifyAdminSession(token: string): AdminSession | null {
  return verifyPayload(token, (data) => {
    if (typeof data.email !== 'string' || !data.email) return null;
    if (!VALID_ROLES.has(data.role as AdminRole)) return null;
    return { email: data.email, role: data.role as AdminRole };
  });
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** 从请求 cookie 解析管理端会话（route handler 用） */
export function getAdminSession(request: Request): AdminSession | null {
  const token = parseCookie(request.headers.get('cookie'), ADMIN_COOKIE);
  return token ? verifyAdminSession(token) : null;
}

/**
 * 角色门槛校验：等级 readonly < ops < super。
 * 通过返回会话；未登录返回 401，权限不足返回 403。
 */
export function requireRole(request: Request, minRole: AdminRole): AdminSession | NextResponse {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (ROLE_LEVEL[session.role] < ROLE_LEVEL[minRole]) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  return session;
}

/** openid 打码：readonly 角色展示前 4 位 + *** */
export function maskOpenid(openid: string): string {
  return openid.slice(0, 4) + '***';
}

/** 服务端组件内取当前管理端会话（middleware 已拦截未登录，此处主要取角色） */
export async function currentAdmin(): Promise<AdminSession | null> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return token ? verifyAdminSession(token) : null;
}
