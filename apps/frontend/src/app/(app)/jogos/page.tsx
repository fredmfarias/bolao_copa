'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { JogoCard } from '@/components/JogoCard';
import { ApostaDrawer } from '@/components/ApostaDrawer';
import { FiltroJogosChips } from '@/components/FiltroJogosChips';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo, Aposta } from '@/types/api';
import {
  getEstadoAposta, jogoNoFiltro, ordenarPorFiltro, type FiltroJogo,
} from '@/lib/jogoEstado';

function agruparPorData(jogos: Jogo[]): Map<string, Jogo[]> {
  const grupos = new Map<string, Jogo[]>();
  for (const jogo of jogos) {
    const chave = new Date(jogo.dataHora).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(jogo);
  }
  return grupos;
}

export default function JogosPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [apostas, setApostas] = useState<Map<string, Aposta>>(new Map());
  const [filtro, setFiltro] = useState<FiltroJogo>('Pendentes');
  const [fixados, setFixados] = useState<Set<string>>(new Set());
  const [jogoSelecionado, setJogoSelecionado] = useState<Jogo | null>(null);
  const [loading, setLoading] = useState(true);

  // Ao trocar de aba, esquece os jogos fixados na aba anterior.
  function trocarFiltro(novo: FiltroJogo) {
    setFiltro(novo);
    setFixados(new Set());
  }

  async function carregar() {
    setLoading(true);
    const [jogosData, apostasData] = await Promise.all([
      api.get<Jogo[]>('/jogos').catch(() => [] as Jogo[]),
      api.get<Aposta[]>('/apostas').catch(() => [] as Aposta[]),
    ]);
    setJogos(jogosData);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
    setLoading(false);
  }

  async function recarregarApostas() {
    const apostasData = await api.get<Aposta[]>('/apostas').catch(() => [] as Aposta[]);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
  }

  useEffect(() => { carregar(); }, []);

  const jogosFiltrados = ordenarPorFiltro(
    jogos.filter(
      j => jogoNoFiltro(getEstadoAposta(j, apostas.get(j.id)), filtro) || fixados.has(j.id),
    ),
    filtro,
  );
  const grupos = agruparPorData(jogosFiltrados);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Jogos</h1>

      <FiltroJogosChips selecionada={filtro} onChange={trocarFiltro} />

      {loading ? (
        <PageSkeleton />
      ) : jogosFiltrados.length === 0 ? (
        <EmptyState titulo="Nenhum jogo" descricao="Não há jogos para este filtro." />
      ) : (
        <div className="space-y-6">
          {Array.from(grupos.entries()).map(([data, jogosGrupo]) => (
            <div key={data}>
              <h2 className="text-trovao-muted text-[10px] font-semibold uppercase tracking-wider mb-2 px-1">
                {data}
              </h2>
              <div className="space-y-3">
                {jogosGrupo.map(jogo => (
                  <JogoCard
                    key={jogo.id}
                    jogo={jogo}
                    aposta={apostas.get(jogo.id)}
                    onApostar={() => setJogoSelecionado(jogo)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {jogoSelecionado && (
        <ApostaDrawer
          key={jogoSelecionado.id}
          jogo={jogoSelecionado}
          aposta={apostas.get(jogoSelecionado.id)}
          aberto={true}
          onFechar={() => setJogoSelecionado(null)}
          onSalvo={() => {
            setFixados(prev => new Set(prev).add(jogoSelecionado.id));
            recarregarApostas();
          }}
        />
      )}
    </div>
  );
}
