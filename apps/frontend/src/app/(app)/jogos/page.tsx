'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { JogoCard } from '@/components/JogoCard';
import { ApostaDrawer } from '@/components/ApostaDrawer';
import { FaseFilterChips } from '@/components/FaseFilterChips';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo, Aposta } from '@/types/api';
import { JogoFase, BOLAO_GLOBAL_ID } from '@bolao/shared';

const FASES = ['Todos', ...Object.values(JogoFase)];

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
  const [fase, setFase] = useState('Todos');
  const [jogoSelecionado, setJogoSelecionado] = useState<Jogo | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const params = fase !== 'Todos' ? `?fase=${fase}` : '';
    const [jogosData, apostasData] = await Promise.all([
      api.get<Jogo[]>(`/jogos${params}`).catch(() => [] as Jogo[]),
      api.get<Aposta[]>(`/apostas/bolao/${BOLAO_GLOBAL_ID}`).catch(() => [] as Aposta[]),
    ]);
    setJogos(jogosData);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
    setLoading(false);
  }

  async function recarregarApostas() {
    const apostasData = await api
      .get<Aposta[]>(`/apostas/bolao/${BOLAO_GLOBAL_ID}`)
      .catch(() => [] as Aposta[]);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
  }

  useEffect(() => { carregar(); }, [fase]);

  const grupos = agruparPorData(jogos);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Jogos</h1>

      <FaseFilterChips fases={FASES} selecionada={fase} onChange={setFase} />

      {loading ? (
        <PageSkeleton />
      ) : jogos.length === 0 ? (
        <EmptyState titulo="Nenhum jogo" descricao="Não há jogos para esta fase." />
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
          bolaoId={BOLAO_GLOBAL_ID}
          aberto={true}
          onFechar={() => setJogoSelecionado(null)}
          onSalvo={recarregarApostas}
        />
      )}
    </div>
  );
}
