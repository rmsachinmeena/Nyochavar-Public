import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { useBodyScrollLock, useEscapeKey } from '../../../hooks/useOverlay';
import { Button, cx } from './primitives';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Desktop max width */
  size?: 'md' | 'lg';
}

const SIZES = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl'
};

/**
 * Bottom sheet on phones, centered dialog from `sm` up.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md'
}) => {
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] font-sans">
          <motion.div
            aria-hidden="true"
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />

          <div className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 24, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.99 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className={cx(
                'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-white shadow-2xl',
                'rounded-t-3xl sm:rounded-2xl sm:border sm:border-slate-200',
                SIZES[size]
              )}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
                  {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

              {footer && (
                <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/* ------------------------------------------------------------------ *
 * Confirm dialog — replaces window.confirm()
 * ------------------------------------------------------------------ */

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'primary' : 'primary'}
          onClick={onConfirm}
          className={destructive ? 'bg-rose-600 hover:bg-rose-700 shadow-[0_1px_2px_rgba(225,29,72,0.25)]' : undefined}
        >
          {confirmLabel}
        </Button>
      </div>
    }
  >
    <div className="flex gap-3">
      <span
        className={cx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          destructive ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
        )}
      >
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div className="min-w-0 pt-1 text-[13px] leading-relaxed text-slate-600">{message}</div>
    </div>
  </Modal>
);
