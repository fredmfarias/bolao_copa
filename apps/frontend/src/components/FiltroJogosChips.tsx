import type { FiltroJogo } from '@/lib/jogoEstado';

const FILTROS: FiltroJogo[] = ['Todos', 'Pendentes', 'Apostados', 'Encerrados', 'Placares'];

const FILTRO_LABELS: Record<FiltroJogo, string> = {
  Todos: 'Todos',
  Pendentes: 'Pendentes de aposta',
  Apostados: 'Apostados',
  Encerrados: 'Encerrados',
  Placares: 'Meus Placares',
};

interface FiltroJogosChipsProps {
  selecionada: FiltroJogo;
  onChange: (filtro: FiltroJogo) => void;
}

export function FiltroJogosChips({ selecionada, onChange }: FiltroJogosChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {FILTROS.map(filtro => (
        <button
          key={filtro}
          onClick={() => onChange(filtro)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            selecionada === filtro
              ? 'bg-trovao-gold text-trovao-base'
              : 'bg-trovao-surface text-trovao-muted hover:text-white'
          }`}
        >
          {FILTRO_LABELS[filtro]}
        </button>
      ))}
    </div>
  );
}
