import { NextResponse } from 'next/server';
import { ingestEvents } from '@/lib/store';
import type { IncomingEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 200;
const MAX_EVENT_ID_LEN = 64;
const MAX_OPENID_LEN = 128;
const MAX_BUILD_ID_LEN = 64;
const MAX_DATA_KEYS = 32;

function sanitizeEvent(raw: unknown): IncomingEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const eventId = obj.event_id;
  if (typeof eventId !== 'string' || !eventId || eventId.length > MAX_EVENT_ID_LEN) return null;

  const ev: IncomingEvent = { event_id: eventId };

  if (obj.openid !== undefined) {
    if (typeof obj.openid !== 'string' || obj.openid.length > MAX_OPENID_LEN) return null;
    ev.openid = obj.openid;
  }
  if (obj.build_id !== undefined) {
    if (typeof obj.build_id !== 'string' || obj.build_id.length > MAX_BUILD_ID_LEN) return null;
    ev.build_id = obj.build_id;
  }
  if (obj.ts !== undefined) {
    if (typeof obj.ts !== 'number' || !Number.isFinite(obj.ts)) return null;
    ev.ts = obj.ts;
  }
  if (obj.data !== undefined) {
    if (typeof obj.data !== 'object' || obj.data === null) return null;
    const entries = Object.entries(obj.data as Record<string, unknown>);
    if (entries.length > MAX_DATA_KEYS) return null;
    const data: Record<string, string | number> = {};
    for (const [k, v] of entries) {
      // 沿用微信自定义分析约束：键值只允许 string/number
      if (typeof v !== 'string' && typeof v !== 'number') return null;
      if (typeof v === 'number' && !Number.isFinite(v)) return null;
      data[k] = v;
    }
    ev.data = data;
  }
  return ev;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) {
    return NextResponse.json({ ok: false, error: 'events must be a non-empty array (<=200)' }, { status: 400 });
  }

  const sanitized: IncomingEvent[] = [];
  for (const raw of events) {
    const ev = sanitizeEvent(raw);
    if (!ev) {
      return NextResponse.json({ ok: false, error: 'malformed event' }, { status: 400 });
    }
    sanitized.push(ev);
  }

  try {
    const count = await ingestEvents(sanitized);
    return NextResponse.json({ ok: true, received: count });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
