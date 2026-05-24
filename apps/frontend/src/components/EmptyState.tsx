interface EmptyStateProps {
  titulo: string;
  descricao?: string;
  acao?: { label: string; onClick: () => void };
}

export function EmptyState({ titulo, descricao, acao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <p className="text-trovao-muted font-semibold">{titulo}</p>
      {descricao && (
        <p className="text-trovao-muted/70 text-sm max-w-xs">{descricao}</p>
      )}
      {acao && (
        <button
          onClick={acao.onClick}
          className="mt-2 px-4 py-2 bg-trovao-gold text-trovao-base font-semibold rounded-lg text-sm"
        >
          {acao.label}
        </button>
      )}
    </div>
  );
}
