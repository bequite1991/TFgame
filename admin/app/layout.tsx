import type { Metadata } from 'next';
import './globals.css';
import Nav from './nav';

export const metadata: Metadata = {
  title: '高塔防线 · 管理端',
  description: '运营数据看板 / 用户 / 配置 / 发布管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">高塔防线</div>
            <div className="brand-sub">Admin Console</div>
            <Nav />
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
