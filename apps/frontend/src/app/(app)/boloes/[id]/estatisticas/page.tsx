// apps/frontend/src/app/(app)/boloes/[id]/estatisticas/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EstatisticaCard, CardLinha } from '@/components/estatisticas/EstatisticaCard';
import { PlacaresChart } from '@/components/estatisticas/PlacaresChart';
import { AproveitamentoFases } from '@/components/estatisticas/AproveitamentoFases';
import type { Bolao, EstatisticasBolao, RecordeRodada, TopEntry } from '@/types/api';

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 mb-3">{titulo}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

/** Card para rankings top-3 (linhas de TopEntry). */
function CardTop({ icone, titulo, legenda, entries, sufixo }: {
  icone: string; titulo: string; legenda: string; entries: TopEntry[]; sufixo: string;
}) {
  if (entries.length === 0) return null;
  const linha = (e: TopEntry): CardLinha => ({ usuarios: e.usuarios, valor: `${e.valor} ${sufixo}` });
  const [primeiro, ...resto] = entries;
  return (
    <EstatisticaCard icone={icone} titulo={titulo} legenda={legenda}
      destaque={linha(primeiro)} secundarios={resto.map(linha)} />
  );
}

/** Card para recordes ligados a uma rodada (RecordeRodada). */
function CardRecorde({ icone, titulo, legenda, recorde, formatarValor }: {
  icone: string; titulo: string; legenda: string;
  recorde: RecordeRodada | null; formatarValor: (valor: number) => string;
}) {
  if (!recorde || recorde.registros.length === 0) return null;
  const linha = (r: RecordeRodada['registros'][number]): CardLinha => ({
    usuarios: [r.usuario],
    valor: `${formatarValor(recorde.valor)} · rodada ${r.publicacao}`,
  });
  const [primeiro, ...resto] = recorde.registros;
  return (
    <EstatisticaCard icone={icone} titulo={titulo} legenda={legenda}
      destaque={linha(primeiro)} secundarios={resto.map(linha)} />
  );
}

function formatarAntecedencia(minutos: number): string {
  if (minutos < 60) return `${minutos} min antes`;
  if (minutos < 48 * 60) return `${Math.round(minutos / 60)}h antes`;
  return `${Math.round(minutos / (24 * 60))} dias antes`;
}

export default function EstatisticasPage() {
  const { id } = useParams<{ id: string }>();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [dados, setDados] = useState<EstatisticasBolao | null>(null);
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const [b, est] = await Promise.all([
        api.get<Bolao>(`/boloes/${id}`),
        api.get<EstatisticasBolao>(`/boloes/${id}/estatisticas`),
      ]);
      setBolao(b);
      setDados(est);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <PageSkeleton />;
  if (erro || !dados) {
    return (
      <div className="text-center space-y-3 py-8">
        <p className="text-red-400">Não foi possível carregar as estatísticas.</p>
        <button onClick={carregar} className="text-sm underline text-trovao-muted hover:text-white">
          Tentar novamente
        </button>
      </div>
    );
  }

  const cabecalho = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold">{bolao?.nome ?? 'Estatísticas'}</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Estatísticas{dados.temDados ? ` · dados até a rodada ${dados.ultimaPublicacao.numero}` : ''}
        </p>
      </div>
      <Link href={`/boloes/${id}`} className="text-trovao-muted text-sm hover:text-white shrink-0">
        ← Voltar
      </Link>
    </div>
  );

  if (!dados.temDados) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <p className="text-trovao-muted text-sm">
          As estatísticas aparecem após a primeira rodada publicada.
        </p>
      </div>
    );
  }

  const { posicoes, recordes, palpites, zebras } = dados;

  return (
    <div className="space-y-8">
      {cabecalho}

      <Secao titulo="🏆 Posições">
        <CardTop icone="👑" titulo="Rei da liderança" legenda="Rodadas terminadas em 1º lugar"
          entries={posicoes.reiDaLideranca} sufixo="rodadas" />
        <CardTop icone="🔦" titulo="Lanterna" legenda="Rodadas terminadas em último lugar"
          entries={posicoes.lanterna} sufixo="rodadas" />
        <CardRecorde icone="🚀" titulo="Foguete da rodada" legenda="Maior subida de posições numa rodada"
          recorde={posicoes.foguete} formatarValor={(v) => `+${v} posições`} />
        <CardRecorde icone="🪂" titulo="Queda livre" legenda="Maior queda de posições numa rodada"
          recorde={posicoes.quedaLivre} formatarValor={(v) => `${v} posições`} />
        {posicoes.maisRegular && (
          <EstatisticaCard icone="📏" titulo="Mais regular"
            legenda="Menor oscilação de posição entre rodadas"
            destaque={{ usuarios: posicoes.maisRegular.usuarios, valor: `±${posicoes.maisRegular.valor}` }} />
        )}
        <CardTop icone="🏅" titulo="Frequência no top 5" legenda="Rodadas terminadas entre os 5 primeiros"
          entries={posicoes.top5} sufixo="rodadas" />
      </Secao>

      <Secao titulo="📈 Recordes">
        <CardRecorde icone="💥" titulo="Maior pontuação numa rodada" legenda="Recorde individual de pontos numa rodada"
          recorde={recordes.maiorPontuacaoRodada} formatarValor={(v) => `${v} pts`} />
        {recordes.rodadaGenerosa && recordes.rodadaAvara && (
          <EstatisticaCard icone="🎁" titulo="Rodada generosa vs avara"
            legenda="Maior e menor pontuação média do bolão"
            destaque={{ texto: `Rodada ${recordes.rodadaGenerosa.publicacao}`, valor: `${recordes.rodadaGenerosa.media} pts` }}
            secundarios={[{ texto: `Rodada ${recordes.rodadaAvara.publicacao}`, valor: `${recordes.rodadaAvara.media} pts` }]} />
        )}
        <CardTop icone="🎯" titulo="Rei do placar exato" legenda="Placares cravados até a última rodada"
          entries={recordes.reiDoPlacarExato} sufixo="placares" />
      </Secao>

      <AproveitamentoFases fases={recordes.aproveitamentoPorFase} />

      <Secao titulo="🎯 Palpites">
        {palpites.jogoConsensual && (
          <EstatisticaCard icone="🤝" titulo="Jogo mais consensual"
            legenda="Maior percentual de palpites no mesmo placar"
            destaque={{ texto: palpites.jogoConsensual.jogo, valor: `${palpites.jogoConsensual.percentual}% em ${palpites.jogoConsensual.placar}` }} />
        )}
        {palpites.jogoDividido && (
          <EstatisticaCard icone="🤯" titulo="Jogo mais dividido"
            legenda="Maior variedade de placares apostados"
            destaque={{ texto: palpites.jogoDividido.jogo, valor: `${palpites.jogoDividido.placaresDistintos} placares` }} />
        )}
        {palpites.otimista && palpites.pessimista && (
          <EstatisticaCard icone="⚖️" titulo="Otimistas vs pessimistas"
            legenda={`Média de gols apostados por jogo${palpites.mediaRealGols !== null ? ` · média real: ${palpites.mediaRealGols}` : ''}`}
            destaque={{ usuarios: palpites.otimista.usuarios, valor: `${palpites.otimista.mediaGols} gols` }}
            secundarios={[{ usuarios: palpites.pessimista.usuarios, valor: `${palpites.pessimista.mediaGols} gols` }]} />
        )}
        {palpites.ultimaHora && palpites.precavido && (
          <EstatisticaCard icone="⏰" titulo="Última hora vs precavido"
            legenda="Mediana da antecedência do palpite ao fechamento"
            destaque={{ usuarios: palpites.ultimaHora.usuarios, valor: formatarAntecedencia(palpites.ultimaHora.medianaMinutos) }}
            secundarios={[{ usuarios: palpites.precavido.usuarios, valor: formatarAntecedencia(palpites.precavido.medianaMinutos) }]} />
        )}
        <CardTop icone="🔁" titulo="Quem mais re-enviou palpites"
          legenda="Palpites re-enviados após o 1º envio (mesmo placar também conta)"
          entries={palpites.reenvios} sufixo="palpites" />
        {palpites.empates && (
          <EstatisticaCard icone="🫱🫲" titulo="Ninguém acredita em empate"
            legenda="Apostas em empate vs empates que aconteceram"
            destaque={{ texto: 'Apostas em empate', valor: `${palpites.empates.percentualApostas}%` }}
            secundarios={[{ texto: 'Empates reais', valor: `${palpites.empates.percentualJogos}%` }]} />
        )}
        <CardTop icone="🙈" titulo="Os mais esquecidos" legenda="Jogos publicados sem palpite enviado"
          entries={palpites.esquecidos} sufixo="jogos" />
      </Secao>

      <PlacaresChart dados={palpites.placaresMaisApostados} />

      <Secao titulo="🦓 Zebras">
        {zebras.zebra && (
          <EstatisticaCard icone="🦓" titulo="A zebra da Copa"
            legenda="Jogo em que menos gente pontuou"
            destaque={{ texto: zebras.zebra.jogo, valor: `${zebras.zebra.percentualPontuaram}% pontuaram` }} />
        )}
        {zebras.previsivel && (
          <EstatisticaCard icone="😴" titulo="Jogo mais previsível"
            legenda="Jogo em que mais gente pontuou"
            destaque={{ texto: zebras.previsivel.jogo, valor: `${zebras.previsivel.percentualPontuaram}% pontuaram` }} />
        )}
      </Secao>

      {zebras.acertosSolitarios.length > 0 && (
        <div className="bg-gray-800/60 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">🎖️ Acertos solitários</h3>
          <div className="space-y-1.5">
            {zebras.acertosSolitarios.map((a, i) => (
              <div key={i} className="text-sm text-gray-300">
                {a.usuario.avatarUrl && (
                  <img src={a.usuario.avatarUrl} alt="" className="inline w-4 h-4 rounded-full mr-1" />
                )}
                {a.usuario.nome}{' · '}{a.jogo}{' · '}
                <span className="text-yellow-400 font-medium">{a.placar}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-trovao-muted mt-2">Placares exatos que só uma pessoa do bolão cravou</p>
        </div>
      )}
    </div>
  );
}
