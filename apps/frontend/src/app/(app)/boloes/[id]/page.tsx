'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { JogoCard } from '@/components/JogoCard';
import { ModeradorPanel } from '@/components/ModeradorPanel';
import { ConvitePanel } from '@/components/ConvitePanel';
import { prazoEncerrado } from '@/lib/jogoEstado';
import type { Bolao, Jogo, Aposta } from '@/types/api';

function ordenarJogosEncerrados(jogos: Jogo[]): Jogo[] {
  return [...jogos]
    .filter(prazoEncerrado)
    .sort((a, b) => {
      const aTemPlacar = a.placarCasa !== null;
      const bTemPlacar = b.placarCasa !== null;
      if (aTemPlacar !== bTemPlacar) return aTemPlacar ? 1 : -1;
      const diff = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
      return aTemPlacar ? -diff : diff;
    });
}

export default function BolaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [apostas, setApostas] = useState<Map<string, Aposta>>(new Map());
  const [loading, setLoading] = useState(true);

  async function carregar() {
    const [b, js, as_] = await Promise.all([
      api.get<Bolao>(`/boloes/${id}`).catch(() => null),
      api.get<Jogo[]>('/jogos').catch(() => []),
      api.get<Aposta[]>('/apostas').catch(() => []),
    ]);
    setBolao(b);
    setJogos(js);
    setApostas(new Map(as_.map(a => [a.jogoId, a])));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  if (loading) return <p className="text-gray-500">Carregando...</p>;
  if (!bolao) return <p className="text-red-400">Bolão não encontrado.</p>;

  const isModerador = bolao.membros?.find(m => m.usuarioId === user?.id)?.papel === 'MODERADOR';
  const jogosEncerrados = ordenarJogosEncerrados(jogos);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{bolao.nome}</h1>
          {bolao.descricao && <p className="text-gray-400 text-sm mt-1">{bolao.descricao}</p>}
        </div>
        <Link href={`/ranking/${id}`}
          className="text-sm text-yellow-400 hover:underline">Ver ranking</Link>
      </div>

      {isModerador && (
        <div className="space-y-4">
          <ConvitePanel bolaoId={id} />
          <ModeradorPanel bolaoId={id} membros={bolao.membros ?? []} onAtualizado={carregar} />
        </div>
      )}

      {!isModerador && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            Membros ({bolao.membros?.length ?? 0})
          </h2>
          <div className="flex flex-wrap gap-2">
            {bolao.membros?.map(m => (
              <div key={m.id} className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1 text-xs">
                {m.usuario.avatarUrl && <img src={m.usuario.avatarUrl} alt="" className="w-4 h-4 rounded-full" />}
                <span>{m.usuario.nome}</span>
                {m.papel === 'MODERADOR' && <span className="text-yellow-400">★</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Jogos</h2>
        {jogosEncerrados.length === 0 ? (
          <p className="text-trovao-muted text-sm">Nenhum jogo encerrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {jogosEncerrados.map(jogo => (
              <JogoCard
                key={jogo.id}
                jogo={jogo}
                aposta={apostas.get(jogo.id)}
                palpitesHref={`/boloes/${id}/palpites/${jogo.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
