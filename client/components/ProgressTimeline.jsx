'use client';

import { motion } from 'framer-motion';
import { PIPELINE_STAGES } from '@/lib/constants';
import { cn } from '@/lib/utils';

function Marker({ state }) {
  if (state === 'done') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 13 4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  if (state === 'running') {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center">
        <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-primary/30" />
        <span className="relative inline-flex h-6 w-6 animate-spin items-center justify-center rounded-full border-2 border-primary border-t-transparent" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card" />
  );
}

export function ProgressTimeline({ stageStates, details = {}, descriptions = true }) {
  return (
    <ol className="relative space-y-1" aria-label="Generation progress">
      {PIPELINE_STAGES.map((stage, i) => {
        const state = stageStates[stage.key] ?? 'pending';
        const detail = details[stage.key];
        return (
          <motion.li
            key={stage.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="relative flex items-start gap-3 rounded-lg px-2 py-2.5"
            aria-current={state === 'running' ? 'step' : undefined}
          >
            {i < PIPELINE_STAGES.length - 1 && (
              <span
                className={cn(
                  'absolute left-[19px] top-9 h-[calc(100%-1.25rem)] w-0.5 rounded',
                  state === 'done' ? 'bg-success/40' : 'bg-border',
                )}
                aria-hidden="true"
              />
            )}
            <Marker state={state} />
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  'text-sm font-medium',
                  state === 'pending' ? 'text-muted' : 'text-ink',
                  state === 'failed' && 'text-accent',
                )}
              >
                {stage.label}
              </p>
              {descriptions && state === 'pending' && (
                <p className="mt-0.5 text-xs text-muted/80">{stage.detail}</p>
              )}
              {detail && state !== 'pending' && (
                <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
