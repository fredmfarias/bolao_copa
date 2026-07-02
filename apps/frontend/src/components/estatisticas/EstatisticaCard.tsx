import type { UsuarioRef } from '@/types/api';

export type CardLinha = {
  usuarios?: UsuarioRef[];
  texto?: string;
  valor: string;
};

const MAX_NOMES = 3;

function Linha({ linha, principal = false }: { linha: CardLinha; principal?: boolean }) {
  const visiveis = (linha.usuarios ?? []).slice(0, MAX_NOMES);
  const extras = (linha.usuarios?.length ?? 0) - visiveis.length;
  const classeNome = principal ? 'text-sm font-medium' : 'text-xs text-gray-400';
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        {linha.texto && <span className={`${classeNome} truncate`}>{linha.texto}</span>}
        {visiveis.map((u) => (
          <span key={u.id} className="flex items-center gap-1 min-w-0">
            {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-4 h-4 rounded-full" />}
            <span className={`${classeNome} truncate`}>{u.nome}</span>
          </span>
        ))}
        {extras > 0 && <span className="text-xs text-trovao-muted">e mais {extras}</span>}
      </div>
      <span className={principal ? 'text-base font-bold text-yellow-400 shrink-0' : 'text-xs text-gray-400 shrink-0'}>
        {linha.valor}
      </span>
    </div>
  );
}

export function EstatisticaCard({ icone, titulo, legenda, destaque, secundarios }: {
  icone: string;
  titulo: string;
  legenda: string;
  destaque: CardLinha;
  secundarios?: CardLinha[];
}) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span aria-hidden>{icone}</span>
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      <Linha linha={destaque} principal />
      {secundarios?.map((l, i) => <Linha key={i} linha={l} />)}
      <p className="text-xs text-trovao-muted">{legenda}</p>
    </div>
  );
}
