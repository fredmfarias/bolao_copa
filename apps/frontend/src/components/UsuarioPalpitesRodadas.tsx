import type { UsuarioPalpitesRodada } from '@/types/api';
import { RankingPalpitesRodada } from './RankingPalpitesRodada';
import { EmptyState } from './EmptyState';
import { formatDataPublicacao } from '@/lib/dataFormat';

interface Props {
  grupos: UsuarioPalpitesRodada[];
}

export function UsuarioPalpitesRodadas({ grupos }: Props) {
  if (grupos.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum palpite"
        descricao="Este usuário ainda não tem palpites em rodadas publicadas."
      />
    );
  }
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.publicacao.numero} className="space-y-2">
          <h2 className="text-trovao-muted text-xs uppercase tracking-wider">
            {formatDataPublicacao(g.publicacao.publicadoEm)}
          </h2>
          <RankingPalpitesRodada items={g.items} />
        </section>
      ))}
    </div>
  );
}
