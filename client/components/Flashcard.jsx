'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * A single practice flashcard with a smooth 3D flip. `front` is the question,
 * `back` is the answer. Clicking (or pressing Enter/Space) toggles the flip.
 */
export function Flashcard({ front, back, flipped, onFlip, className }) {
  return (
    <div className={cn('w-full [perspective:1600px]', className)}>
      <motion.button
        type="button"
        onClick={onFlip}
        className="relative block h-72 w-full text-left sm:h-80"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        aria-label={flipped ? 'Show question' : 'Show answer'}
      >
        <Face className="border-border bg-card">
          <span className="mb-3 inline-block w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Question
          </span>
          <p className="text-xl font-medium leading-relaxed text-ink sm:text-2xl">{front}</p>
          <span className="mt-auto pt-6 text-xs text-muted">Click to reveal answer</span>
        </Face>

        <Face className="border-primary bg-primary text-white" back>
          <span className="mb-3 inline-block w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
            Answer
          </span>
          <p className="text-lg leading-relaxed sm:text-xl">{back}</p>
          <span className="mt-auto pt-6 text-xs text-white/70">Click to see question</span>
        </Face>
      </motion.button>
    </div>
  );
}

function Face({ children, back = false, className }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col overflow-y-auto rounded-xl border p-7 shadow-soft',
        '[backface-visibility:hidden]',
        className,
      )}
      style={{ transform: back ? 'rotateY(180deg)' : undefined }}
    >
      {children}
    </div>
  );
}
