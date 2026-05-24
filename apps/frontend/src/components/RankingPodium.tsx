import type { RankingEntry } from '@/types/api';

const MEDALS = ['🥇', '🥈', '🥉'];
const HEIGHTS = ['h-24', 'h-16', 'h-12'];
const ORDER = [1, 0, 2]; // 2nd, 1st, 3rd visually

interface RankingPodiumProps {
  ranking: RankingEntry[];
  myId?: string;
}

export function RankingPodium({ ranking, myId }: RankingPodiumProps) {
  const top3 = ranking.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-3 py-4">
      {ORDER.map(idx => {
        const entry = top3[idx];
        if (!entry) return <div key={idx} className="w-24" />;
        const isMe = entry.usuarioId === myId;

        return (
          <div key={entry.id} data-my={isMe || undefined}
            className={`flex flex-col items-center gap-1 ${idx === 0 ? 'scale-110' : ''}`}>
            <span className="text-2xl">{MEDALS[idx]}</span>
            {entry.usuario.avatarUrl ? (
              <img src={entry.usuario.avatarUrl} alt={entry.usuario.nome}
                className="w-10 h-10 rounded-full border-2 border-trovao-border" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                ${isMe ? 'bg-trovao-gold text-trovao-base' : 'bg-trovao-surface text-trovao-muted'}`}>
                {entry.usuario.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <p className={`text-xs font-semibold text-center max-w-[72px] truncate
              ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
              {entry.usuario.nome}
            </p>
            <div className={`${HEIGHTS[idx]} w-20 rounded-t-lg flex flex-col items-center justify-end pb-1
              bg-trovao-surface border border-trovao-border`}>
              <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
                {entry.pontuacaoTotal}
              </span>
              <span className="text-trovao-muted text-[10px]">pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
