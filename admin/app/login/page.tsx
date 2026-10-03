'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push('/');
        router.refresh();
        return;
      }
      setMsg(json.error ?? '登录失败');
    } catch {
      setMsg('网络错误');
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="section" style={{ width: 340, marginBottom: 0 }} onSubmit={submit}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>
          高塔防线
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 18 }}>Admin Console 登录</div>

        <label className="field">
          <span>邮箱</span>
          <input
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin"
          />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className="btn" style={{ width: '100%' }} disabled={busy || !email.trim() || !password}>
          {busy ? '登录中…' : '登录'}
        </button>
        {msg && <div className="form-msg err">{msg}</div>}

        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 18, textAlign: 'center' }}>
          《高塔防线》内部运营系统 · 仅限授权人员使用
        </div>
      </form>
    </div>
  );
}
