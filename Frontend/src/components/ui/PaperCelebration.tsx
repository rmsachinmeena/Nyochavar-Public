import React, { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';

const COLORS = ['#2563eb', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#f43f5e', '#06b6d4'];
const PIECE_COUNT = 70;
export const CELEBRATION_MS = 2000;

const random = (min: number, max: number) => min + Math.random() * (max - min);

interface PaperCelebrationProps {
  /** Called once the celebration has finished (after 2 seconds). Keep it referentially stable. */
  onDone?: () => void;
}

/** A 2-second paper confetti shower. Decorative only: ignores pointer events and is hidden from assistive tech. */
export const PaperCelebration: React.FC<PaperCelebrationProps> = ({ onDone }) => {
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, id) => {
        const round = Math.random() < 0.25;
        const size = random(7, 13);
        return {
          id,
          left: random(0, 100),
          width: size,
          height: round ? size : size * 0.45,
          round,
          color: COLORS[id % COLORS.length],
          drift: random(-90, 90),
          rotate: random(-720, 720),
          // delay + duration never exceeds CELEBRATION_MS
          delay: random(0, 0.3),
          duration: random(1.3, 1.7),
        };
      }),
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => onDone?.(), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  if (reducedMotion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-70 overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute top-0 block"
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.height,
            borderRadius: piece.round ? 9999 : 2,
            backgroundColor: piece.color,
          }}
          initial={{ y: '-8vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: piece.drift, rotate: piece.rotate, opacity: [1, 1, 0] }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: [0.2, 0.6, 0.4, 1],
            opacity: { duration: piece.duration, delay: piece.delay, times: [0, 0.75, 1] },
          }}
        />
      ))}
    </div>
  );
};

export default PaperCelebration;
