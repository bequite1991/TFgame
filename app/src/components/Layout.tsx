// 全局布局：TopBar（固定导航 + 移动端抽屉）+ Footer；游戏页只渲染内容区
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { BookOpen, Home, Menu, Orbit, Play, Trophy, X, HelpCircle } from 'lucide-react';

const NAV = [
  { to: '/', label: '主页', icon: Home },
  { to: '/codex', label: '图鉴', icon: BookOpen },
  { to: '/stats', label: '成就', icon: Trophy },
  { to: '/help', label: '说明', icon: HelpCircle },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isGame = pathname.startsWith('/game');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 路由变化时收起移动端抽屉（渲染期间调整状态）
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  if (isGame) return <>{children}</>;

  return (
    <div className="relative min-h-dvh bg-bg-deep text-text">
      {/* 背景装饰层 */}
      <div className="starfield pointer-events-none fixed inset-0 opacity-60 animate-twinkle" />
      <div className="starfield-2 pointer-events-none fixed inset-0 opacity-40 animate-twinkle-slow" />

      <header
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
          scrolled ? 'bg-glass backdrop-blur-xl border-b border-primary/15' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <Orbit className="h-6 w-6 text-primary" />
            <span className="font-orbitron text-sm font-bold tracking-[0.2em] text-primary">
              TOWER LINE
            </span>
            <span className="text-xs font-bold tracking-[0.4em] text-text-dim">高塔防线</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm transition ${
                    isActive ? 'text-primary' : 'text-text-dim hover:text-text'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to="/game"
              className="clip-btn ml-2 bg-primary/90 px-4 py-2 font-orbitron text-xs font-bold tracking-widest text-bg-deep shadow-[0_0_8px_#22E0FF88] transition hover:bg-primary active:scale-95"
            >
              ▶ 开始游戏
            </Link>
          </nav>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-primary md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="菜单"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* 移动端抽屉 */}
        {open && (
          <nav className="border-t border-primary/15 bg-glass backdrop-blur-xl md:hidden">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3.5 text-sm ${
                    isActive ? 'text-primary' : 'text-text-dim'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <Link to="/game" className="flex items-center gap-3 px-6 py-3.5 text-sm font-bold text-primary">
              <Play className="h-4 w-4" />
              开始游戏
            </Link>
          </nav>
        )}
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 border-t border-primary/10 py-6 text-center text-xs text-text-dim">
        © 2242 星环殖民地防御指挥部 · TOWER LINE DEFENSE v1.0
      </footer>
    </div>
  );
}
