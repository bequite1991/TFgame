'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: '总览看板' },
  { href: '/scores', label: '积分榜' },
  { href: '/users', label: '用户列表' },
  { href: '/config', label: '运营配置' },
  { href: '/releases', label: '发布登记' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
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
  );
}
