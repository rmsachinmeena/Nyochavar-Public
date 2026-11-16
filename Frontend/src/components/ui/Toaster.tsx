import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { useUI } from '../../context';
import { SafeImage } from './SafeImage';

export const Toaster: React.FC = () => {
  const { toast, dismissToast } = useUI();
  const isWarning = toast?.tone === 'warning';

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-20 z-[80] flex justify-center px-3 ${
        // A warning is shown at the top of the screen on every device; other toasts keep the bottom-right corner on PCs
        isWarning ? '' : 'sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:justify-end'
      }`}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role={isWarning ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white p-2.5 pr-2 shadow-float ${
              isWarning ? 'border-amber-300' : 'border-slate-200/80'
            }`}
          >
            {isWarning ? (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50">
                <TriangleAlert className="h-6 w-6 text-amber-500" />
              </span>
            ) : toast.image ? (
              <SafeImage src={toast.image} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-cover" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {!isWarning && toast.image && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                {toast.title}
              </p>
              {/* A warning is a sentence the person must read, so it wraps instead of being cut short */}
              {toast.description && (
                <p className={`text-xs text-slate-500 ${isWarning ? 'leading-snug' : 'truncate'}`}>{toast.description}</p>
              )}
            </div>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismissToast();
                }}
                className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-ink-soft"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
