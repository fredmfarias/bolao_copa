const FASE_LABELS: Record<string, string> = {
  Todos: 'Todos',
  GRUPOS: 'Grupos',
  OITAVAS: 'Oitavas',
  QUARTAS: 'Quartas',
  SEMIS: 'Semi',
  TERCEIRO_LUGAR: '3º Lugar',
  FINAL: 'Final',
};

interface FaseFilterChipsProps {
  fases: string[];
  selecionada: string;
  onChange: (fase: string) => void;
}

export function FaseFilterChips({ fases, selecionada, onChange }: FaseFilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {fases.map(fase => (
        <button
          key={fase}
          onClick={() => onChange(fase)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            selecionada === fase
              ? 'bg-trovao-gold text-trovao-base'
              : 'bg-trovao-surface text-trovao-muted hover:text-white'
          }`}
        >
          {FASE_LABELS[fase] ?? fase}
        </button>
      ))}
    </div>
  );
}
