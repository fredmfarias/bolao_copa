import type { RankingEntry } from '@/types/api';

interface RankingPodiumProps {
  ranking: RankingEntry[];
  myId?: string;
}

export function RankingPodium({ ranking, myId }: RankingPodiumProps) {
  const top3 = ranking.slice(0, 3);
  if (top3.length === 0) return null;

  const slots = [
    { entry: top3[1], medal: '🥈', height: 'h-16', isCenter: false },
    { entry: top3[0], medal: '🥇', height: 'h-24', isCenter: true  },
    { entry: top3[2], medal: '🥉', height: 'h-12', isCenter: false },
  ];

  return (
    <div className="flex items-end justify-center gap-3 py-4">
      {slots.map(({ entry, medal, height, isCenter }, i) => {
        if (!entry) return <div key={i} className="w-24" />;
        const isMe = entry.usuarioId === myId;

        return (
          <div key={entry.id} data-my={isMe || undefined}
            className={`flex flex-col items-center gap-1 ${isCenter ? 'scale-110' : ''}`}>
            <span className="text-2xl">{medal}</span>
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
            <div className={`${height} w-20 rounded-t-lg flex flex-col items-center justify-end pb-1
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
