'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const ITEMS = [
  { href: '/', label: '总览看板' },
  { href: '/scores', label: '积分榜' },
  { href: '/users', label: '用户列表' },
  { href: '/config', label: '运营配置' },
  { href: '/releases', label: '发布登记' },
];

const ROLE_LABEL: Record<string, string> = {
  super: '超管',
  ops: '运营',
  readonly: '只读',
};

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => json?.ok && setMe({ email: json.email, role: json.role }))
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* 失败也跳登录页 */
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <nav>
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? 'active' : ''}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {me && (
        <div className="userbox">
          <div className="userbox-email" title={me.email}>{me.email}</div>
          <div className="userbox-row">
            <span className="tag">{ROLE_LABEL[me.role] ?? me.role}</span>
            <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={logout}>
              退出
            </button>
          </div>
        </div>
      )}
    </>
  );
}
