import Nav from '../nav';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">高塔防线</div>
        <div className="brand-sub">Admin Console</div>
        <Nav />
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
