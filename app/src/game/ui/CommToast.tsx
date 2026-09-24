// 战场通讯条 —— HUD 下滑出，4 秒自动消失，可堆叠多条
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface CommItem {
  id: number;
  wave: number;
  text: string;
}

interface Props {
  items: CommItem[];
  onDismiss: (id: number) => void;
}

function CommToastCard({ item, onDismiss }: { item: CommItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ type: 'spring', damping: 22 }}
      className="clip-panel flex w-full max-w-md items-start gap-2.5 border border-primary/40 bg-bg-panel/90 px-3.5 py-2.5 shadow-[0_0_16px_#22E0FF33] backdrop-blur-md"
    >
      <span className="mt-0.5 shrink-0 text-primary">◈</span>
      <div className="min-w-0">
        <div className="font-orbitron text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
          副官 AI·曦
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-text">{item.text}</p>
      </div>
    </motion.div>
  );
}

export default function CommToast({ items, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {items.map((item) => (
          <CommToastCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
