'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface UsuarioBusca {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
}

interface UsuarioSelecionado {
  id: string;
  nome: string;
  email: string;
}

export default function AdminNotificacoesPage() {
  const [titulo, setTitulo]           = useState('');
  const [corpo, setCorpo]             = useState('');
  const [alvo, setAlvo]               = useState<'todos' | 'lista'>('todos');
  const [selecionados, setSelecionados] = useState<UsuarioSelecionado[]>([]);
  const [busca, setBusca]             = useState('');
  const [resultados, setResultados]   = useState<UsuarioBusca[]>([]);
  const [buscando, setBuscando]       = useState(false);
  const [enviando, setEnviando]       = useState(false);
  const [feedback, setFeedback]       = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alvo !== 'lista' || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const data = await api.get<UsuarioBusca[]>(`/admin/usuarios/buscar?q=${encodeURIComponent(busca)}`);
        setResultados(data.filter((u) => !selecionados.some((s) => s.id === u.id)));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
  }, [busca, alvo, selecionados]);

  function adicionarUsuario(u: UsuarioBusca) {
    setSelecionados((prev) => [...prev, { id: u.id, nome: u.nome, email: u.email }]);
    setBusca('');
    setResultados([]);
  }

  function removerUsuario(id: string) {
    setSelecionados((prev) => prev.filter((u) => u.id !== id));
  }

  async function enviar() {
    if (!titulo.trim() || !corpo.trim()) return;
    if (alvo === 'lista' && selecionados.length === 0) return;

    setEnviando(true);
    setFeedback(null);
    try {
      const body: { titulo: string; corpo: string; usuarioIds?: string[] } = {
        titulo: titulo.trim(),
        corpo: corpo.trim(),
      };
      if (alvo === 'lista') body.usuarioIds = selecionados.map((u) => u.id);

      const res = await api.post<{ message: string }>('/admin/notificacoes/enviar', body);
      setFeedback({ tipo: 'ok', msg: res.message });
      setTitulo('');
      setCorpo('');
      setSelecionados([]);
    } catch (err: unknown) {
      setFeedback({ tipo: 'erro', msg: err instanceof Error ? err.message : 'Erro ao enviar.' });
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar =
    titulo.trim().length > 0 &&
    corpo.trim().length > 0 &&
    !enviando &&
    (alvo === 'todos' || selecionados.length > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Notificações</h1>
      <p className="text-trovao-muted text-xs -mt-4">
        Envie push manualmente para todos os usuários ou para uma lista específica.
      </p>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-trovao-muted uppercase tracking-wide">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={100}
            placeholder="Ex: Resultados da rodada!"
            className="w-full bg-trovao-card border border-trovao-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-trovao-muted focus:outline-none focus:border-trovao-gold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-trovao-muted uppercase tracking-wide">Mensagem</label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            maxLength={250}
            rows={3}
            placeholder="Ex: A rodada 5 foi publicada. Confira sua posição!"
            className="w-full bg-trovao-card border border-trovao-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-trovao-muted focus:outline-none focus:border-trovao-gold resize-none"
          />
          <p className="text-trovao-muted text-[10px] text-right">{corpo.length}/250</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-trovao-muted uppercase tracking-wide">Destinatários</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAlvo('todos')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                alvo === 'todos'
                  ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-card text-trovao-muted border-trovao-border hover:text-white'
              }`}
            >
              Todos os usuários
            </button>
            <button
              onClick={() => setAlvo('lista')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                alvo === 'lista'
                  ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-card text-trovao-muted border-trovao-border hover:text-white'
              }`}
            >
              Lista específica
            </button>
          </div>
        </div>

        {alvo === 'lista' && (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar usuário por nome ou email"
                className="w-full bg-trovao-card border border-trovao-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-trovao-muted focus:outline-none focus:border-trovao-gold"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-trovao-muted pointer-events-none"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {buscando && (
              <p className="text-trovao-muted text-xs px-1">Buscando...</p>
            )}

            {resultados.length > 0 && (
              <div className="bg-trovao-card border border-trovao-border rounded-xl overflow-hidden divide-y divide-trovao-border">
                {resultados.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => adicionarUsuario(u)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-trovao-surface text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-trovao-surface flex items-center justify-center shrink-0 overflow-hidden">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xs text-trovao-muted font-bold">{u.nome[0]?.toUpperCase()}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{u.nome}</p>
                      <p className="text-[10px] text-trovao-muted truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selecionados.length > 0 && (
              <div className="space-y-1">
                <p className="text-trovao-muted text-xs">{selecionados.length} usuário(s) selecionado(s)</p>
                <div className="flex flex-wrap gap-2">
                  {selecionados.map((u) => (
                    <span
                      key={u.id}
                      className="flex items-center gap-1 bg-trovao-surface border border-trovao-border rounded-full px-3 py-1 text-xs text-white"
                    >
                      {u.nome}
                      <button
                        onClick={() => removerUsuario(u.id)}
                        className="ml-1 text-trovao-muted hover:text-trovao-red leading-none"
                        aria-label={`Remover ${u.nome}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {feedback && (
          <p className={`text-sm font-semibold ${feedback.tipo === 'ok' ? 'text-trovao-green' : 'text-trovao-red'}`}>
            {feedback.msg}
          </p>
        )}

        <button
          onClick={enviar}
          disabled={!podeEnviar}
          className="w-full py-3 rounded-xl bg-trovao-gold text-trovao-base text-sm font-bold disabled:opacity-40 transition-opacity"
        >
          {enviando ? 'Enviando...' : 'Enviar notificação'}
        </button>
      </div>
    </div>
  );
}
