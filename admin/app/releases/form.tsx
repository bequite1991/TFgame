'use client';

import { useState } from 'react';

export default function ReleaseForm() {
  const [buildId, setBuildId] = useState('');
  const [wxVersion, setWxVersion] = useState('');
  const [gitCommit, setGitCommit] = useState('');
  const [status, setStatus] = useState('dev');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          build_id: buildId.trim(),
          wx_version: wxVersion.trim() || undefined,
          git_commit: gitCommit.trim() || undefined,
          status,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ ok: true, text: `已登记 ${json.release.build_id}（刷新页面见列表）` });
        setBuildId('');
        setNotes('');
      } else {
        setMsg({ ok: false, text: json.error ?? '登记失败' });
      }
    } catch {
      setMsg({ ok: false, text: '网络错误' });
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="form-row">
        <label className="field">
          <span>build_id *（如 b1002-1530）</span>
          <input value={buildId} onChange={(e) => setBuildId(e.target.value)} />
        </label>
        <label className="field">
          <span>微信开发版本号</span>
          <input value={wxVersion} onChange={(e) => setWxVersion(e.target.value)} />
        </label>
        <label className="field">
          <span>git commit</span>
          <input value={gitCommit} onChange={(e) => setGitCommit(e.target.value)} />
        </label>
        <label className="field">
          <span>状态</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="dev">dev</option>
            <option value="trial">trial（体验版）</option>
            <option value="released">released</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>发布说明</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 60 }} />
      </label>
      <button className="btn" onClick={submit} disabled={busy || !buildId.trim()}>
        {busy ? '提交中…' : '登记'}
      </button>
      {msg && <div className={`form-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  );
}
