import type { UsuarioRef } from '@/types/api';

const ROTULOS: Record<string, string> = {
  GRUPOS: 'Grupos',
  SEGUNDA_FASE: '2ª fase',
  OITAVAS: 'Oitavas',
  QUARTAS: 'Quartas',
  SEMIS: 'Semis',
  TERCEIRO_LUGAR: '3º lugar',
  FINAL: 'Final',
};

type Fase = {
  fase: string;
  aproveitamento: number;
  melhor: { usuarios: UsuarioRef[]; pontos: number } | null;
};

export function AproveitamentoFases({ fases }: { fases: Fase[] }) {
  if (fases.length === 0) return null;
  return (
    <div className="bg-gray-800/60 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">📊 Aproveitamento por fase</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-trovao-muted text-left">
            <th className="font-normal pb-1">Fase</th>
            <th className="font-normal pb-1 text-right">Bolão</th>
            <th className="font-normal pb-1 text-right">Melhor da fase</th>
          </tr>
        </thead>
        <tbody>
          {fases.map((f) => (
            <tr key={f.fase} className="border-t border-gray-700/60">
              <td className="py-1.5">{ROTULOS[f.fase] ?? f.fase}</td>
              <td className="py-1.5 text-right font-medium text-yellow-400">{f.aproveitamento}%</td>
              <td className="py-1.5 text-right text-gray-300">
                {f.melhor
                  ? `${f.melhor.usuarios.map((u) => u.nome).join(', ')} (${f.melhor.pontos} pts)`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-trovao-muted mt-1">
        Pontos do bolão ÷ máximo possível (placar exato × peso) em cada fase
      </p>
    </div>
  );
}
