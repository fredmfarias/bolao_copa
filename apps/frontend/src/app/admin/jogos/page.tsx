'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import type { Jogo, Selecao, Estadio } from '@/types/api';

const FASES_ELIMINATORIAS = [
  { value: 'SEGUNDA_FASE',   label: 'Segunda Fase' },
  { value: 'OITAVAS',        label: 'Oitavas de Final' },
  { value: 'QUARTAS',        label: 'Quartas de Final' },
  { value: 'SEMIS',          label: 'Semifinal' },
  { value: 'TERCEIRO_LUGAR', label: 'Terceiro Lugar' },
  { value: 'FINAL',          label: 'Final' },
];

const PESOS = [
  { value: 1, label: '×1 — Normal' },
  { value: 2, label: '×2 — Duplo' },
  { value: 3, label: '×3 — Triplo' },
  { value: 4, label: '×4 — Quádruplo' },
];

function faseLegivel(fase: string) {
  return FASES_ELIMINATORIAS.find(f => f.value === fase)?.label ?? fase;
}

function pesoClass(peso: number) {
  if (peso >= 4) return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (peso === 3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (peso === 2) return 'bg-green-500/20 text-green-400 border-green-500/30';
  return 'bg-trovao-surface text-trovao-muted border-trovao-border';
}

function formatDataHora(dataHora: string) {
  const d = new Date(dataHora);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const INPUT = 'w-full bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-trovao-gold';
const LABEL = 'block text-xs text-trovao-muted mb-1';

type FormState = {
  fase: string;
  data: string;
  hora: string;
  estadioId: string;
  selecaoCasaId: string;
  selecaoVisitanteId: string;
  rodada: number;
  pesoPontuacao: number;
};

const FORM_INICIAL: FormState = {
  fase: 'SEGUNDA_FASE',
  data: '',
  hora: '15:00',
  estadioId: '',
  selecaoCasaId: '',
  selecaoVisitanteId: '',
  rodada: 1,
  pesoPontuacao: 1,
};

export default function AdminJogosPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [selecoes, setSelecoes] = useState<Selecao[]>([]);
  const [estadios, setEstadios] = useState<Estadio[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar() {
    setLoading(true);
    const [todosJogos, todasSelecoes, todosEstadios] = await Promise.all([
      api.get<Jogo[]>('/jogos').catch(() => [] as Jogo[]),
      api.get<Selecao[]>('/admin/selecoes').catch(() => [] as Selecao[]),
      api.get<Estadio[]>('/admin/estadios').catch(() => [] as Estadio[]),
    ]);
    const eliminatorios = todosJogos.filter(j => j.fase !== 'GRUPOS');
    eliminatorios.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
    setJogos(eliminatorios);
    setSelecoes(todasSelecoes);
    setEstadios(todosEstadios);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.data) { setErro('Informe a data do jogo.'); return; }
    if (!form.estadioId) { setErro('Selecione o estádio.'); return; }
    if (!form.selecaoCasaId) { setErro('Selecione a seleção mandante.'); return; }
    if (!form.selecaoVisitanteId) { setErro('Selecione a seleção visitante.'); return; }
    if (form.selecaoCasaId === form.selecaoVisitanteId) {
      setErro('Seleções mandante e visitante devem ser diferentes.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      const dataHora = new Date(`${form.data}T${form.hora}:00`).toISOString();
      await api.post('/jogos', {
        fase: form.fase,
        dataHora,
        estadioId: form.estadioId,
        selecaoCasaId: form.selecaoCasaId,
        selecaoVisitanteId: form.selecaoVisitanteId,
        rodada: form.rodada,
        pesoPontuacao: form.pesoPontuacao,
      });
      setCriando(false);
      setForm(FORM_INICIAL);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar jogo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Jogos — Fase Eliminatória</h1>
        <button
          onClick={() => { setCriando(v => !v); setErro(''); setForm(FORM_INICIAL); }}
          className="bg-trovao-gold text-trovao-base font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90">
          {criando ? 'Cancelar' : '+ Novo jogo'}
        </button>
      </div>

      {criando && (
        <form onSubmit={handleCriar}
          className="bg-trovao-card border border-trovao-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Cadastrar jogo eliminatório</h2>

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LABEL}>Fase</label>
              <select value={form.fase} onChange={e => set('fase', e.target.value)} className={INPUT}>
                {FASES_ELIMINATORIAS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Data</label>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} required className={INPUT} />
            </div>

            <div>
              <label className={LABEL}>Hora</label>
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} required className={INPUT} />
            </div>

            <div className="col-span-2">
              <label className={LABEL}>Estádio</label>
              <select value={form.estadioId} onChange={e => set('estadioId', e.target.value)} className={INPUT}>
                <option value="">Selecione o estádio…</option>
                {estadios.map(est => (
                  <option key={est.id} value={est.id}>{est.nome} — {est.cidade}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Seleção mandante</label>
              <select value={form.selecaoCasaId} onChange={e => set('selecaoCasaId', e.target.value)} className={INPUT}>
                <option value="">Selecione…</option>
                {selecoes.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Seleção visitante</label>
              <select value={form.selecaoVisitanteId} onChange={e => set('selecaoVisitanteId', e.target.value)} className={INPUT}>
                <option value="">Selecione…</option>
                {selecoes.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Rodada</label>
              <input
                type="number" min={1} value={form.rodada}
                onChange={e => set('rodada', Number(e.target.value))}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Peso do jogo</label>
              <select value={form.pesoPontuacao} onChange={e => set('pesoPontuacao', Number(e.target.value))} className={INPUT}>
                {PESOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={salvando}
            className="w-full bg-trovao-gold text-trovao-base font-bold py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Cadastrando…' : 'Cadastrar jogo'}
          </button>
        </form>
      )}

      {loading ? (
        <PageSkeleton />
      ) : jogos.length === 0 ? (
        <EmptyState titulo="Nenhum jogo eliminatório cadastrado" />
      ) : (
        <div className="space-y-2">
          {jogos.map(jogo => (
            <JogoEliminatorioCard key={jogo.id} jogo={jogo} />
          ))}
        </div>
      )}
    </div>
  );
}

function JogoEliminatorioCard({ jogo }: { jogo: Jogo }) {
  return (
    <div className="bg-trovao-card border border-trovao-border rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-trovao-muted text-xs">{faseLegivel(jogo.fase)} · R{jogo.rodada}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${pesoClass(jogo.pesoPontuacao)}`}>
          ×{jogo.pesoPontuacao}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
          <span className="text-white text-sm font-semibold truncate">{jogo.selecaoCasa.nome}</span>
        </div>
        <span className="text-trovao-muted text-xs shrink-0 font-bold">×</span>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-white text-sm font-semibold truncate text-right">{jogo.selecaoVisitante.nome}</span>
          <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-trovao-muted text-xs">
        <span>{formatDataHora(jogo.dataHora)}</span>
        {jogo.estadio && <span>· {jogo.estadio.nome}</span>}
      </div>
    </div>
  );
}
