import Link from 'next/link';
import type { Jogo, Aposta } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { getEstadoAposta, formatDataAposta, type EstadoAposta } from '@/lib/jogoEstado';

const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:        'border-trovao-border hover:border-trovao-green/40',
  salvo:         'border-trovao-green',
  aguardando:    'border-trovao-border opacity-85',
  finalizado:    'border-trovao-border',
  'sem-palpite': 'border-trovao-border opacity-85',
};

const ESTADO_BADGE: Partial<Record<EstadoAposta, string>> = {
  aguardando:    'Aguardando placar',
  'sem-palpite': 'Sem palpite',
};

const PESO_BADGE: Record<number, string> = {
  1: 'bg-trovao-surface text-trovao-muted',
  2: 'bg-trovao-green text-trovao-base',
  3: 'bg-trovao-gold text-trovao-base',
  4: 'bg-trovao-red text-white',
};

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
  palpitesHref?: string;
}

export function JogoCard({ jogo, aposta, onApostar, palpitesHref }: JogoCardProps) {
  const estado = getEstadoAposta(jogo, aposta);
  const temResultado = jogo.placarCasa !== null && jogo.placarVisitante !== null;

  const borderClass = estado === 'finalizado' && (aposta?.pontuacao ?? 0) > 0
    ? 'border-trovao-green/40'
    : ESTADO_BORDER[estado];
  const badge = ESTADO_BADGE[estado];

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-2 transition-colors ${borderClass}`}>
      {/* Header: título + peso + hora + palpites */}
      <div className="flex justify-between items-center gap-2">
        <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-white/90 leading-tight">
          {jogo.selecaoCasa.nome} × {jogo.selecaoVisitante.nome}
        </p>
        <div className="flex items-center gap-2 text-xs text-trovao-muted shrink-0">
          {palpitesHref && (
            <Link href={palpitesHref}
              className="text-trovao-gold text-[10px] font-bold hover:underline shrink-0">
              Palpites →
            </Link>
          )}
          <span title={`Esse jogo tem peso ×${jogo.pesoPontuacao}`}
            className={`cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              PESO_BADGE[jogo.pesoPontuacao] ?? PESO_BADGE[4]
            }`}>
            ×{jogo.pesoPontuacao}
          </span>
          {badge ? (
            <span className="rounded-full bg-trovao-surface px-2 py-0.5 text-[10px] font-semibold text-trovao-muted">
              {badge}
            </span>
          ) : (
            <span>{formatHora(jogo.dataHora)}</span>
          )}
        </div>
      </div>

      {/* Pílula fase/grupo/rodada */}
      <div className="flex justify-center">
        <span className="rounded-full bg-trovao-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-trovao-muted">
          {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}
        </span>
      </div>

      {/* Times + palpite central */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="rounded-md bg-trovao-surface p-1 ring-1 ring-trovao-border">
            <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="lg" shape="rect" />
          </div>
          <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="flex flex-col items-center gap-0.5 rounded-xl bg-trovao-surface px-3 py-2">
          <ScoreDisplay
            placarCasa={aposta?.placarCasa ?? null}
            placarVisitante={aposta?.placarVisitante ?? null}
          />
          <span className="text-trovao-muted text-[10px] uppercase tracking-wider">Palpite</span>
          {aposta && (
            <span className="text-trovao-muted text-[10px]">{formatDataAposta(aposta.palpiteAtualizadoEm)}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="rounded-md bg-trovao-surface p-1 ring-1 ring-trovao-border">
            <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="lg" shape="rect" />
          </div>
          <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {/* Rodapé: placar real do jogo e/ou pontuação */}
      {(temResultado || aposta?.pontuacao != null) && (
        <div className="border-t border-trovao-border pt-2 flex items-center justify-between text-xs">
          <span className="text-trovao-muted">Placar:</span>
          <span className="text-white font-mono font-semibold text-sm">
            {temResultado ? `${jogo.placarCasa} × ${jogo.placarVisitante}` : '—'}
          </span>
          {aposta?.pontuacao != null && (
            <span className="text-trovao-gold font-bold">+{aposta.pontuacao} pts</span>
          )}
        </div>
      )}

      {/* Botão de aposta */}
      {(estado === 'aberto' || estado === 'salvo') && onApostar && (
        <button
          onClick={onApostar}
          className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
            estado === 'salvo'
              ? 'bg-trovao-surface text-trovao-green border border-trovao-green hover:bg-trovao-green/10'
              : 'bg-trovao-gold text-trovao-base hover:bg-trovao-gold/90'
          }`}
        >
          {estado === 'salvo' ? 'Editar palpite' : 'Apostar'}
        </button>
      )}
    </div>
  );
}
