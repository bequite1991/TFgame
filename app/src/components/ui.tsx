// 共享 UI 原语：PanelCard / NeonButton / StatChip / SectionTitle
import type { ReactNode } from 'react';

export function PanelCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`clip-panel relative border border-primary/25 bg-bg-panel/80 backdrop-blur-md ${className}`}>
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
      {children}
    </div>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'gold';

export function NeonButton({
  children,
  variant = 'primary',
  className = '',
  onClick,
  disabled,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles: Record<BtnVariant, string> = {
    primary:
      'bg-primary/90 text-bg-deep font-bold shadow-[0_0_8px_#22E0FF88,0_0_24px_#22E0FF33] hover:bg-primary',
    ghost: 'border border-primary/50 text-primary hover:bg-primary/10',
    danger:
      'border border-accent/60 text-accent hover:bg-accent/10 shadow-[0_0_8px_#FF3D8144]',
    gold: 'bg-gold/90 text-bg-deep font-bold shadow-[0_0_8px_#FFC94D66] hover:bg-gold',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`clip-btn inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-2.5 text-sm tracking-wider transition active:scale-[0.92] disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function StatChip({ icon, label, value, className = '' }: { icon: ReactNode; label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`clip-panel flex items-center gap-3 border border-primary/20 bg-bg-panel/70 px-4 py-3 ${className}`}>
      <span className="text-primary">{icon}</span>
      <div>
        <div className="font-orbitron text-lg font-bold leading-none text-text">{value}</div>
        <div className="mt-1 text-xs text-text-dim">{label}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ en, zh, className = '' }: { en: string; zh: string; className?: string }) {
  return (
    <div className={className}>
      <h2 className="font-orbitron text-xl font-bold uppercase tracking-[0.15em] text-primary">{en}</h2>
      <p className="mt-1 text-sm font-bold text-text">{zh}</p>
      <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-primary to-transparent" />
    </div>
  );
}
