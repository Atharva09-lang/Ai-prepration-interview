'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Fetches a single kit (and its latest job) with loading/error/refetch.
 * `setKit` lets callers apply edits optimistically so the UI feels immediate,
 * while the mutation call runs in the background.
 */
export function useKit(id) {
  const [state, setState] = useState({ kit: null, job: null, loading: true, error: null });

  const load = useCallback(async () => {
    if (!id) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { kit, job } = await api.getKit(id);
      setState({ kit, job, loading: false, error: null });
    } catch (err) {
      setState({
        kit: null,
        job: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load kit',
      });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setKit = useCallback((kit) => {
    setState((s) => ({ ...s, kit }));
  }, []);

  return { ...state, refetch: load, setKit };
}
