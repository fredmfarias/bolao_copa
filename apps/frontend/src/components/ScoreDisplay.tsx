interface ScoreDisplayProps {
  placarCasa: number | null;
  placarVisitante: number | null;
}

export function ScoreDisplay({ placarCasa, placarVisitante }: ScoreDisplayProps) {
  if (placarCasa === null || placarVisitante === null) {
    return (
      <span className="text-trovao-muted text-xl font-mono tracking-widest">
        {'— : —'}
      </span>
    );
  }

  return (
    <span className="text-white text-xl font-mono font-bold tracking-widest">
      {placarCasa} : {placarVisitante}
    </span>
  );
}
