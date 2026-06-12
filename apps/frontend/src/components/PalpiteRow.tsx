import { SelecaoAvatar } from './SelecaoAvatar';
import { MEDALHAS } from '@/lib/medalhas';
import type { Palpite, Jogo } from '@/types/api';

interface PalpiteRowProps {
  palpite: Palpite;
  jogo: Jogo;
  posicao?: number;
  isMe: boolean;
}

function formatarAtualizadoEm(iso: string) {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${data} às ${hora}`;
}

export function PalpiteRow({ palpite: p, jogo, posicao, isMe }: PalpiteRowProps) {
  const medalha = posicao !== undefined ? MEDALHAS[posicao] : undefined;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-trovao-card border ${
        medalha ? medalha.border : 'border-trovao-border'
      } ${isMe ? 'ring-2 ring-trovao-gold/60' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {posicao !== undefined && (
          <span
            className={`text-sm w-7 flex-shrink-0 ${
              medalha ? `${medalha.texto} font-bold` : 'text-trovao-muted'
            }`}
          >
            {posicao}º
          </span>
        )}
        {p.avatarUrl ? (
          <img src={p.avatarUrl} alt={p.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-trovao-surface flex-shrink-0 flex items-center justify-center text-xs font-bold text-trovao-muted">
            {p.nome.charAt(0).toUpperCase()}
          </div>
        )}
        <span className={`text-sm font-medium break-words min-w-0 ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {p.nome}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <span className="flex items-center gap-1.5 text-white font-mono text-sm font-semibold">
            <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
            {p.placarCasa} × {p.placarVisitante}
            <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
          </span>
          <span className="text-trovao-muted text-[8px] leading-none">
            {formatarAtualizadoEm(p.atualizadoEm)}
          </span>
        </div>
        {p.pontuacao !== null && (
          <span className="text-trovao-gold text-sm font-bold tabular-nums">+{p.pontuacao}</span>
        )}
      </div>
    </div>
  );
}
