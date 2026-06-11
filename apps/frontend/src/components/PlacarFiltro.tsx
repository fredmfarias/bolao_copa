import { contarPlacares } from '@/lib/palpites';
import type { Palpite } from '@/types/api';

interface PlacarFiltroProps {
  palpites: Palpite[];
  value: string | null;
  onChange: (value: string | null) => void;
}

function chipClass(ativo: boolean): string {
  return `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
    ativo
      ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
      : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'
  }`;
}

export function PlacarFiltro({ palpites, value, onChange }: PlacarFiltroProps) {
  const placares = contarPlacares(palpites);
  if (placares.length <= 1) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={() => onChange(null)} className={chipClass(value === null)}>
        Todos
      </button>
      {placares.map((pl) => (
        <button
          key={pl.key}
          type="button"
          onClick={() => onChange(pl.key)}
          className={chipClass(value === pl.key)}
        >
          {pl.casa} × {pl.visitante}
          <span className="ml-1 opacity-70">· {pl.count}</span>
        </button>
      ))}
    </div>
  );
}
