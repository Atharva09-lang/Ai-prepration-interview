'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Fetches the signed-in user's kit list with loading/error/refetch. */
export function useKits() {
  const [state, setState] = useState({ kits: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { kits } = await api.listKits();
      setState({ kits, loading: false, error: null });
    } catch (err) {
      setState({
        kits: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load kits',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
