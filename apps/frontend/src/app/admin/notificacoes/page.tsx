'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface LembreteJogo {
  jogoId: string;
  dataHora: string;
  casa: string;
  visitante: string;
  agendado: boolean;
}

function formatDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminNotificacoesPage() {
  // ── Push manual ──────────────────────────────────────────────────────────
  const [titulo, setTitulo]             = useState('');
  const [corpo, setCorpo]               = useState('');
  const [alvo, setAlvo]                 = useState<'todos' | 'lista'>('todos');
  const [selecionados, setSelecionados] = useState<UsuarioSelecionado[]>([]);
  const [busca, setBusca]               = useState('');
  const [resultados, setResultados]     = useState<UsuarioBusca[]>([]);
  const [buscando, setBuscando]         = useState(false);
  const [enviando, setEnviando]         = useState(false);
  const [feedbackPush, setFeedbackPush] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lembretes ────────────────────────────────────────────────────────────
  const [lembretes, setLembretes]           = useState<LembreteJogo[]>([]);
  const [carregandoLemb, setCarregandoLemb] = useState(false);
  const [reagendando, setReagendando]       = useState(false);
  const [feedbackLemb, setFeedbackLemb]     = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  const carregarLembretes = useCallback(async () => {
    setCarregandoLemb(true);
    setFeedbackLemb(null);
    try {
      const data = await api.get<LembreteJogo[]>('/admin/jogos/lembretes');
      setLembretes(data);
    } catch {
      setFeedbackLemb({ tipo: 'erro', msg: 'Erro ao carregar lembretes.' });
    } finally {
      setCarregandoLemb(false);
    }
  }, []);

  useEffect(() => { carregarLembretes(); }, [carregarLembretes]);

  async function reagendarLembretes() {
    setReagendando(true);
    setFeedbackLemb(null);
    try {
      const res = await api.post<{ total: number; agendados: number }>('/admin/jogos/reagendar-lembretes');
      setFeedbackLemb({ tipo: 'ok', msg: `${res.agendados} de ${res.total} jogo(s) agendado(s).` });
      await carregarLembretes();
    } catch {
      setFeedbackLemb({ tipo: 'erro', msg: 'Erro ao reagendar.' });
    } finally {
      setReagendando(false);
    }
  }

  const semLembrete = lembretes.filter((l) => !l.agendado).length;

  // ── Busca de usuários ────────────────────────────────────────────────────
  useEffect(() => {
    if (alvo !== 'lista' || busca.trim().length < 2) { setResultados([]); return; }
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
    setFeedbackPush(null);
    try {
      const body: { titulo: string; corpo: string; usuarioIds?: string[] } = {
        titulo: titulo.trim(), corpo: corpo.trim(),
      };
      if (alvo === 'lista') body.usuarioIds = selecionados.map((u) => u.id);
      const res = await api.post<{ message: string }>('/admin/notificacoes/enviar', body);
      setFeedbackPush({ tipo: 'ok', msg: res.message });
      setTitulo(''); setCorpo(''); setSelecionados([]);
    } catch (err: unknown) {
      setFeedbackPush({ tipo: 'erro', msg: err instanceof Error ? err.message : 'Erro ao enviar.' });
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar =
    titulo.trim().length > 0 && corpo.trim().length > 0 && !enviando &&
    (alvo === 'todos' || selecionados.length > 0);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Notificações</h1>

      {/* ── Lembretes de jogo ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Lembretes de jogo (2h antes)</h2>
            <p className="text-trovao-muted text-xs">
              Jogos futuros sem placar —{' '}
              {carregandoLemb ? 'verificando...' : `${lembretes.length} jogo(s), ${semLembrete} sem lembrete`}
            </p>
          </div>
          <button
            onClick={carregarLembretes}
            disabled={carregandoLemb}
            className="text-trovao-muted text-xs hover:text-white transition-colors disabled:opacity-40"
          >
            Atualizar
          </button>
        </div>

        {lembretes.length > 0 && (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {lembretes.map((l) => (
              <div key={l.jogoId}
                className="flex items-center justify-between px-3 py-2 bg-trovao-card rounded-lg text-xs">
                <span className="text-white truncate flex-1">
                  {l.casa} <span className="text-trovao-muted">x</span> {l.visitante}
                </span>
                <span className="text-trovao-muted shrink-0 ml-2">{formatDataHora(l.dataHora)}</span>
                <span className={`shrink-0 ml-3 font-semibold ${l.agendado ? 'text-trovao-green' : 'text-trovao-red'}`}>
                  {l.agendado ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        )}

        {feedbackLemb && (
          <p className={`text-xs font-semibold ${feedbackLemb.tipo === 'ok' ? 'text-trovao-green' : 'text-trovao-red'}`}>
            {feedbackLemb.msg}
          </p>
        )}

        <button
          onClick={reagendarLembretes}
          disabled={reagendando || carregandoLemb || semLembrete === 0}
          className="w-full py-2.5 rounded-xl border border-trovao-border bg-trovao-card text-sm font-semibold text-white disabled:opacity-40 hover:border-trovao-gold transition-colors"
        >
          {reagendando ? 'Reagendando...' : `Reagendar lembretes${semLembrete > 0 ? ` (${semLembrete})` : ''}`}
        </button>
      </section>

      <div className="border-t border-trovao-border" />

      {/* ── Push manual ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Enviar push manual</h2>
          <p className="text-trovao-muted text-xs">Para todos os usuários ou uma lista específica.</p>
        </div>

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
            {(['todos', 'lista'] as const).map((v) => (
              <button key={v} onClick={() => setAlvo(v)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  alvo === v
                    ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                    : 'bg-trovao-card text-trovao-muted border-trovao-border hover:text-white'
                }`}>
                {v === 'todos' ? 'Todos os usuários' : 'Lista específica'}
              </button>
            ))}
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
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {buscando && <p className="text-trovao-muted text-xs px-1">Buscando...</p>}

            {resultados.length > 0 && (
              <div className="bg-trovao-card border border-trovao-border rounded-xl overflow-hidden divide-y divide-trovao-border">
                {resultados.map((u) => (
                  <button key={u.id} onClick={() => adicionarUsuario(u)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-trovao-surface text-left transition-colors">
                    <div className="w-7 h-7 rounded-full bg-trovao-surface flex items-center justify-center shrink-0 overflow-hidden">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xs text-trovao-muted font-bold">{u.nome[0]?.toUpperCase()}</span>}
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
                    <span key={u.id}
                      className="flex items-center gap-1 bg-trovao-surface border border-trovao-border rounded-full px-3 py-1 text-xs text-white">
                      {u.nome}
                      <button onClick={() => removerUsuario(u.id)}
                        className="ml-1 text-trovao-muted hover:text-trovao-red leading-none"
                        aria-label={`Remover ${u.nome}`}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {feedbackPush && (
          <p className={`text-sm font-semibold ${feedbackPush.tipo === 'ok' ? 'text-trovao-green' : 'text-trovao-red'}`}>
            {feedbackPush.msg}
          </p>
        )}

        <button
          onClick={enviar}
          disabled={!podeEnviar}
          className="w-full py-3 rounded-xl bg-trovao-gold text-trovao-base text-sm font-bold disabled:opacity-40 transition-opacity"
        >
          {enviando ? 'Enviando...' : 'Enviar notificação'}
        </button>
      </section>
    </div>
  );
}
