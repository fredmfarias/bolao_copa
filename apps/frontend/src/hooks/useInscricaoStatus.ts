'use client';

import { useEffect, useState } from 'react';

const TTL_MS = 60_000;
const KEY = 'inscricao-status';
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CachedStatus {
  value: { abertas: boolean; dataCorte: string | null };
  expiresAt: number;
}

function readCache(): CachedStatus['value'] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedStatus;
    if (parsed.expiresAt > Date.now()) return parsed.value;
    return null;
  } catch {
    return null;
  }
}

function writeCache(value: CachedStatus['value']) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ value, expiresAt: Date.now() + TTL_MS } satisfies CachedStatus),
  );
}

export function useInscricaoStatus() {
  const [state, setState] = useState<{ abertas: boolean; loading: boolean }>(() => {
    const cached = readCache();
    if (cached) return { abertas: cached.abertas, loading: false };
    return { abertas: true, loading: true };
  });

  useEffect(() => {
    if (!state.loading) return;
    let cancelled = false;
    fetch(`${BASE}/auth/inscricoes/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { abertas: boolean; dataCorte: string | null }) => {
        if (cancelled) return;
        writeCache(data);
        setState({ abertas: data.abertas, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ abertas: true, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [state.loading]);

  return state;
}
