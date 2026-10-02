import { NextResponse } from 'next/server';
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { key, value, updated_by } = (body ?? {}) as {
    key?: unknown;
    value?: unknown;
    updated_by?: unknown;
  };
  if (typeof key !== 'string' || !key || key.length > 128) {
    return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });
  }
  if (value === undefined) {
    return NextResponse.json({ ok: false, error: 'value required' }, { status: 400 });
  }

  try {
    const entry = await putConfig(key, value, typeof updated_by === 'string' ? updated_by : undefined);
    return NextResponse.json({ ok: true, config: entry });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
