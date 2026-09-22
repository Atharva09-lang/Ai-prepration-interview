'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PIPELINE_STAGES, POLL_INTERVAL_MS } from '@/lib/constants';

/** Latest status per stage key, defaulting to 'pending'. */
export function deriveStageStates(job) {
  const states = {};
  for (const s of PIPELINE_STAGES) states[s.key] = 'pending';
  if (!job) return states;
  for (const entry of job.progress ?? []) {
    if (entry.stage in states) states[entry.stage] = entry.status;
  }
  return states;
}

/** Per-stage detail text from the latest progress entry for each stage. */
export function deriveStageDetails(job) {
  const details = {};
  for (const p of job?.progress ?? []) {
    if (p.detail) details[p.stage] = p.detail;
  }
  return details;
}

/**
 * Polls GET /api/jobs/:id until the job reaches a terminal state.
 * Returns the live job plus a per-stage status map for the timeline.
 */
export function useJobPolling(jobId, opts = {}) {
  const { enabled = true, onTerminal } = opts;
  const [job, setJob] = useState(null);
  const [pollError, setPollError] = useState(null);
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    if (!jobId || !enabled) return undefined;
    let active = true;
    let timer;

    const tick = async () => {
      try {
        const { job: fresh } = await api.getJob(jobId);
        if (!active) return;
        setJob(fresh);
        setPollError(null);
        if (fresh.status === 'succeeded' || fresh.status === 'failed') {
          onTerminalRef.current?.(fresh);
          return; // stop polling
        }
      } catch (err) {
        if (!active) return;
        setPollError(err instanceof Error ? err.message : 'Polling failed');
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, enabled]);

  const stageStates = deriveStageStates(job);
  const isRunning = job ? job.status === 'queued' || job.status === 'running' : true;

  return { job, stageStates, isRunning, pollError };
}
