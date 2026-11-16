import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { X } from 'lucide-react';
import { useBodyScrollLock, useEscapeKey } from '../../hooks/useOverlay';

type SheetSide = 'left' | 'right' | 'bottom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  side?: SheetSide;
  children: React.ReactNode;
  footer?: React.ReactNode;
  panelClassName?: string;
}

const PANEL_POSITION: Record<SheetSide, string> = {
  right: 'inset-y-0 right-0 h-full w-full max-w-md sm:rounded-l-3xl',
  left: 'inset-y-0 left-0 h-full w-[88%] max-w-sm rounded-r-3xl',
  bottom: 'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-3xl',
};

const PANEL_MOTION = {
  right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
  left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
  bottom: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } },
};

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  side = 'right',
  children,
  footer,
  panelClassName = '',
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const isBottom = side === 'bottom';

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="storefront fixed inset-0 z-[60] font-body text-ink antialiased">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`absolute flex flex-col bg-white shadow-float outline-none ${PANEL_POSITION[side]} ${panelClassName}`}
            {...PANEL_MOTION[side]}
            transition={{ type: 'spring', damping: 34, stiffness: 340, mass: 0.9 }}
            drag={isBottom ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            {isBottom && (
              <div
                className="flex cursor-grab touch-none justify-center pb-1 pt-3"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <span className="h-1.5 w-10 rounded-full bg-slate-200" />
              </div>
            )}

            <div className={`flex items-center justify-between gap-3 border-b border-slate-100 px-5 ${isBottom ? 'pb-3 pt-1' : 'py-4'}`}>
              <h2 id={titleId} className="min-w-0 flex-1 truncate font-serif text-xl text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

            {footer && (
              <div className="border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
