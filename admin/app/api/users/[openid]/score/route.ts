import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { adjustUserPoints } from '@/lib/store';

export const dynamic = 'force-dynamic';

const MAX_DELTA = 1_000_000;
const MAX_REASON_LEN = 200;

export async function POST(request: Request, { params }: { params: Promise<{ openid: string }> }) {
  // 积分调整：ops 及以上
  const session = requireRole(request, 'ops');
  if (session instanceof NextResponse) return session;

  const { openid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const obj = body as { delta?: unknown; reason?: unknown };

  if (typeof obj?.delta !== 'number' || !Number.isFinite(obj.delta)) {
    return NextResponse.json({ ok: false, error: 'delta must be a finite number' }, { status: 400 });
  }
  if (typeof obj.reason !== 'string' || !obj.reason.trim() || obj.reason.length > MAX_REASON_LEN) {
    return NextResponse.json({ ok: false, error: `reason required (<= ${MAX_REASON_LEN} chars)` }, { status: 400 });
  }

  // 单次调整幅度钳制在 ±100 万
  const delta = Math.min(Math.max(obj.delta, -MAX_DELTA), MAX_DELTA);
  const result = await adjustUserPoints(openid, delta, obj.reason.trim(), session.email);
  if (!result) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, openid, ...result });
}
