import { NextResponse } from 'next/server';
import { topScores } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const top = Math.min(Number(searchParams.get('top')) || 100, 500);
    const scores = topScores(top);
    return NextResponse.json({ ok: true, total: scores.length, scores });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
