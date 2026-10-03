import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getConfig, listConfigs, putConfig } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (key) {
      const entry = getConfig(key);
      if (!entry) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
      return NextResponse.json({ ok: true, config: entry });
    }
    return NextResponse.json({ ok: true, configs: listConfigs() });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 配置发布：ops 及以上
  const session = requireRole(request, 'ops');
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { key, value } = (body ?? {}) as {
    key?: unknown;
    value?: unknown;
  };
  if (typeof key !== 'string' || !key || key.length > 128) {
    return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });
  }
  if (value === undefined) {
    return NextResponse.json({ ok: false, error: 'value required' }, { status: 400 });
  }

  try {
    // 更新人以登录会话为准，便于审计
    const entry = await putConfig(key, value, session.email);
    return NextResponse.json({ ok: true, config: entry });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
