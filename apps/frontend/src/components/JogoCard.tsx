import type { Jogo, Aposta } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

type JogoCardEstado = 'aberto' | 'salvo' | 'incompleto' | 'fechado';

const ESTADO_BORDER: Record<JogoCardEstado, string> = {
  aberto:    'border-trovao-border hover:border-trovao-green/40',
  salvo:     'border-trovao-green',
  incompleto:'border-trovao-gold',
  fechado:   'border-trovao-border opacity-60',
};

function getEstado(jogo: Jogo, aposta?: Aposta): JogoCardEstado {
  const prazo = new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000;
  const estaFechado = Date.now() >= prazo;
  if (!estaFechado && !aposta) return 'aberto';
  if (!estaFechado && aposta)  return 'salvo';
  if (estaFechado  && aposta)  return 'fechado';
  return 'incompleto';
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
}

export function JogoCard({ jogo, aposta, onApostar }: JogoCardProps) {
  const estado = getEstado(jogo, aposta);

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-3 transition-colors ${ESTADO_BORDER[estado]}`}>
      {/* Header */}
      <div className="flex justify-between items-center text-xs text-trovao-muted">
        <span>{jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}</span>
        <span>{formatHora(jogo.dataHora)}</span>
      </div>

      {/* Times */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ScoreDisplay placarCasa={jogo.placarCasa} placarVisitante={jogo.placarVisitante} />
          {estado === 'aberto' && (
            <span className="text-trovao-muted text-[10px]">Aposte agora</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {/* Footer por estado */}
      {(estado === 'salvo' || estado === 'fechado') && aposta && (
        <div className="border-t border-trovao-border pt-2 flex items-center justify-between text-xs">
          <span className="text-trovao-muted">Seu palpite:</span>
          <span className="text-white font-mono font-semibold">
            {aposta.placarCasa} × {aposta.placarVisitante}
          </span>
          {aposta.pontuacao !== null && (
            <span className="text-trovao-gold font-bold">+{aposta.pontuacao} pts</span>
          )}
        </div>
      )}

      {estado === 'incompleto' && (
        <p className="text-trovao-muted text-xs text-center border-t border-trovao-border pt-2">
          Prazo encerrado — sem aposta
        </p>
      )}

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
