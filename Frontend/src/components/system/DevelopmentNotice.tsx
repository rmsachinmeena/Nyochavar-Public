import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Wrench } from 'lucide-react';

/**
 * TEMPORARY: a card shown for 3 seconds when someone opens the home page, saying the website is still being built.
 * To remove it later: delete this file, and delete the import and the <DevelopmentNotice /> line in pages/home/HomePage.tsx.
 */
const SHOW_FOR_MS = 3000;

export const DevelopmentNotice: React.FC = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), SHOW_FOR_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[90] flex justify-center px-3 sm:top-24">
      <AnimatePresence>
        {visible && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-amber-300 bg-white p-3.5 shadow-float sm:p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 sm:h-11 sm:w-11">
              <Wrench className="h-5 w-5 text-amber-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Our website is under development</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-[13px]">
                Please wait a few days while we connect with you. We will be back soon on your domain.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default DevelopmentNotice;
