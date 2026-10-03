import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_S, signAdminSession } from '@/lib/auth';
import {
  clearLoginFails,
  findAdmin,
  lockRemainingMin,
  recordLoginFail,
  touchLastLogin,
  verifyPassword,
} from '@/lib/admins';

export const dynamic = 'force-dynamic';

// 账号不存在时也跑一次 scrypt，抹平时间侧信道
let DUMMY_HASH: string | null = null;
function dummyVerify(password: string): void {
  if (!DUMMY_HASH) {
    DUMMY_HASH =
      'scrypt:16384:8:1:00000000000000000000000000000000:' +
      '0'.repeat(64);
  }
  verifyPassword(password, DUMMY_HASH);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return NextResponse.json({ ok: false, error: 'email and password required' }, { status: 400 });
  }
  const id = email.trim();

  // 锁定检查优先于密码校验：锁定期间即使密码正确也拒绝
  const locked = lockRemainingMin(id);
  if (locked > 0) {
    return NextResponse.json(
      { ok: false, error: `账号已锁定，请 ${locked} 分钟后重试` },
      { status: 423 },
    );
  }

  const admin = findAdmin(id);
  const passOk = admin ? verifyPassword(password, admin.password_hash) : (dummyVerify(password), false);
  if (!passOk || !admin) {
    const nowLocked = recordLoginFail(id);
    if (nowLocked > 0) {
      return NextResponse.json(
        { ok: false, error: `失败次数过多，账号已锁定，请 ${nowLocked} 分钟后重试` },
        { status: 423 },
      );
    }
    // 统一文案，不区分账号不存在 / 密码错误
    return NextResponse.json({ ok: false, error: '邮箱或密码错误' }, { status: 401 });
  }

  clearLoginFails(id);
  touchLastLogin(id);

  const res = NextResponse.json({ ok: true, role: admin.role });
  res.cookies.set(ADMIN_COOKIE, signAdminSession(admin.email, admin.role), {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: ADMIN_SESSION_TTL_S,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
