'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { UserSearchResult } from '@/types/api';

interface Props {
  value: { id: string; nome: string } | null;
  onChange: (user: { id: string; nome: string } | null) => void;
}

export function UserSearchInput({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.nome ?? '');
  const [sugestoes, setSugestoes] = useState<UserSearchResult[]>([]);
  const [aberto, setAberto] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2 || value) {
      setSugestoes([]);
      setAberto(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const data = await api
        .get<UserSearchResult[]>(`/admin/usuarios/buscar?q=${encodeURIComponent(query)}`)
        .catch(() => []);
      setSugestoes(data);
      setAberto(data.length > 0);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, value]);

  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  function selecionar(u: UserSearchResult) {
    onChange({ id: u.id, nome: u.nome });
    setQuery(u.nome);
    setSugestoes([]);
    setAberto(false);
  }

  function limpar() {
    onChange(null);
    setQuery('');
    setSugestoes([]);
    setAberto(false);
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null); }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
        />
        {value && (
          <button type="button" onClick={limpar}
            className="text-gray-400 hover:text-white px-2 text-lg leading-none">
            ✕
          </button>
        )}
      </div>
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {sugestoes.map(u => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => selecionar(u)}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm">
                <span className="text-white">{u.nome}</span>
                <span className="text-gray-400 ml-2 text-xs">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
