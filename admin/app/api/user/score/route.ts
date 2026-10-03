import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getScoreProfile, getUser, mergeScoreProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';

const LEVEL_KEY_RE = /^\d+$/;
const MAX_LEVEL_BEST_VALUE = 1_000_000;
const MAX_LEVEL_BEST_KEYS = 50;

function nonNegative(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** 鉴权 + 封禁检查，通过时返回 openid */
function authorize(request: Request): { openid: string } | NextResponse {
  const openid = verifyToken(request.headers.get('authorization'));
  if (!openid) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const user = getUser(openid);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  if (user.status === 'banned') {
    return NextResponse.json({ ok: false, error: 'banned' }, { status: 403 });
  }
  return { openid };
}

export async function GET(request: Request) {
  const auth = authorize(request);
  if (auth instanceof NextResponse) return auth;

  const profile = getScoreProfile(auth.openid);
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile });
}

export async function POST(request: Request) {
  const auth = authorize(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;

  const points = nonNegative(obj?.points);
  if (points === null) {
    return NextResponse.json({ ok: false, error: 'points must be a non-negative number' }, { status: 400 });
  }

  let bestSingle: number | undefined;
  if (obj.bestSingle !== undefined) {
    const v = nonNegative(obj.bestSingle);
    if (v === null) {
      return NextResponse.json({ ok: false, error: 'bestSingle must be a non-negative number' }, { status: 400 });
    }
    bestSingle = v;
  }

  let perLevelBest: Record<string, number> | undefined;
  if (obj.perLevelBest !== undefined) {
    if (typeof obj.perLevelBest !== 'object' || obj.perLevelBest === null) {
      return NextResponse.json({ ok: false, error: 'perLevelBest must be an object' }, { status: 400 });
    }
    const entries = Object.entries(obj.perLevelBest as Record<string, unknown>);
    if (entries.length > MAX_LEVEL_BEST_KEYS) {
      return NextResponse.json({ ok: false, error: `perLevelBest keys must be <= ${MAX_LEVEL_BEST_KEYS}` }, { status: 400 });
    }
    perLevelBest = {};
    for (const [k, v] of entries) {
      if (!LEVEL_KEY_RE.test(k) || typeof v !== 'number' || !Number.isFinite(v)) {
        return NextResponse.json(
          { ok: false, error: 'perLevelBest keys must be numeric strings with finite number values' },
          { status: 400 },
        );
      }
      // 值钳制为非负且单条不超过上限
      perLevelBest[k] = Math.min(Math.max(0, v), MAX_LEVEL_BEST_VALUE);
    }
  }

  const profile = await mergeScoreProfile(auth.openid, { points, bestSingle, perLevelBest });
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile });
}
