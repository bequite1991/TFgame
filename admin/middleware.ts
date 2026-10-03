// 管理端会话保护：除登录页 / 鉴权接口 / 小游戏客户端接口外，一律要求有效会话 cookie
// 注意：middleware 运行在 Edge 运行时，不能用 node:crypto，验签走 Web Crypto
import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'srd_admin';
// 与 lib/auth.ts 保持一致；生产环境必须配置 SESSION_SECRET
const SECRET = process.env.SESSION_SECRET || 'srd-dev-secret';

/** 公开路径：登录页、管理端鉴权接口、小游戏客户端接口（各自已有 Bearer/无鉴权逻辑，不得拦截） */
function isPublic(pathname: string): boolean {
  if (pathname === '/login') return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname === '/api/login' || pathname === '/api/collect' || pathname === '/api/user/score') return true;
  return false;
}

function b64urlEncode(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** 校验会话 token：HMAC-SHA256 验签 + exp 检查（仅判有效，不取角色） */
async function verifyAdminToken(token: string): Promise<boolean> {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expected = b64urlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
    if (expected.length !== sig.length) return false;
    // 常量时间比较
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return false;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { exp?: unknown };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (token && (await verifyAdminToken(token))) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url, 302);
}

export const config = {
  // 排除 Next 静态资源与图片优化
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
