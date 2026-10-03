import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { listReleases, putRelease } from '@/lib/store';
import type { ReleaseStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_STATUS = new Set<ReleaseStatus>(['dev', 'trial', 'released']);
const BUILD_ID_RE = /^[\w.-]{1,64}$/;

export async function GET() {
  try {
    return NextResponse.json({ ok: true, releases: listReleases() });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 版本登记：ops 及以上
  const session = requireRole(request, 'ops');
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { build_id, wx_version, git_commit, notes, status } = (body ?? {}) as Record<string, unknown>;
  if (typeof build_id !== 'string' || !BUILD_ID_RE.test(build_id)) {
    return NextResponse.json({ ok: false, error: 'build_id required (e.g. b1002-1530)' }, { status: 400 });
  }
  const st: ReleaseStatus = VALID_STATUS.has(status as ReleaseStatus) ? (status as ReleaseStatus) : 'dev';

  try {
    const release = await putRelease({
      build_id,
      wx_version: typeof wx_version === 'string' ? wx_version : undefined,
      git_commit: typeof git_commit === 'string' ? git_commit : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
      status: st,
    });
    return NextResponse.json({ ok: true, release });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
