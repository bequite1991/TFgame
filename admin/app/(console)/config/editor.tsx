'use client';

import { useState } from 'react';

export default function ConfigEditor({ existingKeys }: { existingKeys: string[] }) {
  const [key, setKey] = useState(existingKeys[0] ?? 'notice');
  const [valueText, setValueText] = useState('{\n  "title": "",\n  "body": "",\n  "level": "info"\n}');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadKey(k: string) {
    setKey(k);
    setMsg(null);
    try {
      const res = await fetch(`/api/config?key=${encodeURIComponent(k)}`);
      const json = await res.json();
      if (json.ok) setValueText(JSON.stringify(json.config.value, null, 2));
    } catch {
      /* 拉取失败保留当前编辑内容 */
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    let value: unknown;
    try {
      value = JSON.parse(valueText);
    } catch {
      setBusy(false);
      setMsg({ ok: false, text: 'value 不是合法 JSON' });
      return;
    }
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ ok: true, text: `已保存：${json.config.key} → v${json.config.version}（刷新页面见列表）` });
      } else {
        setMsg({ ok: false, text: json.error ?? '保存失败' });
      }
    } catch {
      setMsg({ ok: false, text: '网络错误' });
    }
    setBusy(false);
  }

  return (
    <div>
      {existingKeys.length > 0 && (
        <label className="field">
          <span>载入已有配置</span>
          <select value="" onChange={(e) => e.target.value && loadKey(e.target.value)}>
            <option value="">选择 key…</option>
            {existingKeys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>配置 key</span>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="notice / home_banner / ad_double_loot / balance.difficulty" />
      </label>
      <label className="field">
        <span>value（JSON）</span>
        <textarea className="mono" value={valueText} onChange={(e) => setValueText(e.target.value)} />
      </label>
      <button className="btn" onClick={save} disabled={busy || !key.trim()}>
        {busy ? '保存中…' : '保存（版本 +1）'}
      </button>
      {msg && <div className={`form-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  );
}
