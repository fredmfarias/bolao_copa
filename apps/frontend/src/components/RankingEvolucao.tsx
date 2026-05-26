'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { EvolucaoPonto } from '@/types/api';

interface RankingEvolucaoProps {
  dados: EvolucaoPonto[];
}

export function RankingEvolucao({ dados }: RankingEvolucaoProps) {
  if (dados.length === 0) {
    return (
      <p className="text-trovao-muted text-sm text-center py-6">
        Sem histórico de posições ainda.
      </p>
    );
  }

  const maxPos = Math.max(...dados.map((d) => d.posicao));

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <XAxis
            dataKey="numero"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'Rodada', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            reversed
            domain={[1, maxPos]}
            allowDecimals={false}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Tooltip
            formatter={(v: any) => [`${v}º`, 'Posição'] as [string, string]}
            labelFormatter={(l: any) => `Rodada ${l}`}
            contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }}
          />
          <Line type="monotone" dataKey="posicao" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
