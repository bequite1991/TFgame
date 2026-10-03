'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function UserActions({ openid, banned }: { openid: string; banned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(url: string, payload: unknown): Promise<boolean> {
    setBusy(true);
    let ok = false;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        ok = true;
      } else {
        window.alert(json.error ?? '操作失败');
      }
    } catch {
      window.alert('网络错误');
    }
    setBusy(false);
    if (ok) router.refresh();
    return ok;
  }

  async function adjustScore() {
    const deltaText = window.prompt(`调整「${openid}」的积分（正加负减，单次 ±1,000,000）`);
    if (deltaText === null) return;
    const delta = Number(deltaText);
    if (!Number.isFinite(delta) || delta === 0) {
      window.alert('请输入非零数值');
      return;
    }
    const reason = window.prompt('请输入调整原因（必填，≤200 字）');
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert('调整原因必填');
      return;
    }
    await post(`/api/users/${encodeURIComponent(openid)}/score`, { delta, reason: reason.trim() });
  }

  async function toggleBan() {
    const action = banned ? '解封' : '封禁';
    if (!window.confirm(`确认${action}「${openid}」？`)) return;
    await post(`/api/users/${encodeURIComponent(openid)}/ban`, { banned: !banned });
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn" onClick={adjustScore} disabled={busy}>调整积分</button>
      <button className="btn" onClick={toggleBan} disabled={busy}>{banned ? '解封' : '封禁'}</button>
    </div>
  );
}
