import type { RankingEntry } from '@/types/api';

interface Props {
  ranking: RankingEntry[];
  myId?: string;
}

export function RankingTable({ ranking, myId }: Props) {
  if (ranking.length === 0) return <p className="text-gray-500 text-sm text-center">Ranking ainda não disponível.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="py-2 text-left w-8">#</th>
            <th className="py-2 text-left">Participante</th>
            <th className="py-2 text-right">Pts</th>
            <th className="py-2 text-right hidden sm:table-cell">Exatos</th>
            <th className="py-2 text-right hidden sm:table-cell">Apostas</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map(r => (
            <tr key={r.id}
              className={`border-b border-gray-800/50 ${r.usuarioId === myId ? 'bg-yellow-400/10' : ''}`}>
              <td className="py-2 text-gray-500">{r.posicao}º</td>
              <td className="py-2 flex items-center gap-2">
                {r.usuario.avatarUrl && (
                  <img src={r.usuario.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                )}
                <span className={r.usuarioId === myId ? 'text-yellow-400 font-semibold' : ''}>
                  {r.usuario.nome}
                </span>
              </td>
              <td className="py-2 text-right font-bold text-yellow-400">{r.pontuacaoTotal}</td>
              <td className="py-2 text-right text-gray-400 hidden sm:table-cell">{r.acertosPlacarExato}</td>
              <td className="py-2 text-right text-gray-400 hidden sm:table-cell">{r.apostasPostadas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
