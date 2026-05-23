'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { setAccessToken, clearAccessToken } from '@/lib/auth';
import type { Usuario } from '@/types/api';

interface AuthCtx {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.post<{ accessToken: string }>('/auth/refresh');
      setAccessToken(data.accessToken);
      const me = await api.get<Usuario>('/usuarios/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function login(email: string, senha: string) {
    const data = await api.post<{ accessToken: string }>('/auth/login', { email, senha });
    setAccessToken(data.accessToken);
    const me = await api.get<Usuario>('/usuarios/me');
    setUser(me);
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    clearAccessToken();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
