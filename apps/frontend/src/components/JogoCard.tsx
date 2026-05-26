import type { Jogo, Aposta } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { getEstadoAposta, formatDataAposta, type EstadoAposta } from '@/lib/jogoEstado';

const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:    'border-trovao-border hover:border-trovao-green/40',
  salvo:     'border-trovao-green',
  incompleto:'border-trovao-gold',
  fechado:   'border-trovao-border opacity-60',
};

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
}

export function JogoCard({ jogo, aposta, onApostar }: JogoCardProps) {
  const estado = getEstadoAposta(jogo, aposta);
  const temResultado = jogo.placarCasa !== null && jogo.placarVisitante !== null;

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-3 transition-colors ${ESTADO_BORDER[estado]}`}>
      {/* Título */}
      <p className="text-sm font-semibold text-white text-center">
        {jogo.selecaoCasa.nome} × {jogo.selecaoVisitante.nome}
      </p>

      {/* Header */}
      <div className="flex justify-between items-center text-xs text-trovao-muted">
        <span>{jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              jogo.pesoPontuacao > 1
                ? 'bg-trovao-gold text-trovao-base'
                : 'bg-trovao-surface text-trovao-muted'
            }`}
          >
            ×{jogo.pesoPontuacao}
          </span>
          <span>{formatHora(jogo.dataHora)}</span>
        </div>
      </div>

      {/* Times + palpite central */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ScoreDisplay
            placarCasa={aposta?.placarCasa ?? null}
            placarVisitante={aposta?.placarVisitante ?? null}
          />
          <span className="text-trovao-muted text-[10px] uppercase tracking-wider">Palpite</span>
          {aposta && (
            <span className="text-trovao-muted text-[10px]">{formatDataAposta(aposta.atualizadoEm)}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {/* Rodapé: placar real do jogo */}
      {temResultado && (
        <div className="border-t border-trovao-border pt-2 flex items-center justify-between text-xs">
          <span className="text-trovao-muted">Placar:</span>
          <span className="text-white font-mono font-semibold">
            {jogo.placarCasa} × {jogo.placarVisitante}
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
