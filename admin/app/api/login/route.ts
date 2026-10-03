import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { loginUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

const MAX_CODE_LEN = 128;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const code = (body as { code?: unknown })?.code;
  if (typeof code !== 'string' || !code.trim() || code.length > MAX_CODE_LEN) {
    return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });
  }

  let openid: string;
  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;

  if (appid && secret) {
    // 生产模式：微信 code2session 换 openid；session_key 只用于服务端，禁止返回客户端/落盘
    const url =
      `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;
    let data: { openid?: string; errcode?: number; errmsg?: string };
    try {
      const res = await fetch(url);
      data = (await res.json()) as typeof data;
    } catch {
      return NextResponse.json({ ok: false, error: 'wx request failed' }, { status: 502 });
    }
    if (data.errcode || !data.openid) {
      return NextResponse.json(
        { ok: false, error: `wx error ${data.errcode}: ${data.errmsg ?? 'no openid'}` },
        { status: 400 },
      );
    }
    openid = data.openid;
  } else {
    // 开发模式：同一 code 映射到同一确定性 openid
    openid = 'dev_' + crypto.createHash('sha256').update(code).digest('hex').slice(0, 24);
  }

  await loginUser(openid);
  return NextResponse.json({ ok: true, openid, token: signToken(openid) });
}
