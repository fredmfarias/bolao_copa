import type { RodadaPalpiteItem } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

interface Props {
  items: RodadaPalpiteItem[];
}

export function RankingPalpitesRodada({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-trovao-muted text-xs text-center py-2">Esta rodada não tem jogos.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-trovao-muted text-[10px] uppercase tracking-wider">Palpites da rodada</p>
      <ul className="divide-y divide-trovao-border/30 rounded-lg bg-trovao-surface/40">
        {items.map(({ jogo, palpite, pontuacao }) => (
          <li key={jogo.id} className="px-2 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
                <span className="text-white font-semibold">{jogo.selecaoCasa.codigo}</span>
                {palpite ? (
                  <span className="text-white font-bold mx-1">{palpite.placarCasa} × {palpite.placarVisitante}</span>
                ) : (
                  <span className="text-trovao-muted mx-1">Sem palpite</span>
                )}
                <span className="text-white font-semibold">{jogo.selecaoVisitante.codigo}</span>
                <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
              </div>
              {jogo.pesoPontuacao !== 1 && (
                <span className="text-[10px] font-bold text-trovao-gold">×{jogo.pesoPontuacao}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-trovao-muted">
                Placar: {jogo.placarCasa} × {jogo.placarVisitante}
              </span>
              {palpite && (
                <span className={pontuacao > 0 ? 'text-trovao-gold font-bold' : 'text-trovao-muted'}>
                  +{pontuacao} pts
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
