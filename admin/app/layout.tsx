import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '高塔防线 · 管理端',
  description: '运营数据看板 / 用户 / 配置 / 发布管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
