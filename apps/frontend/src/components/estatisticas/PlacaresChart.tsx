'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export function PlacaresChart({ dados }: { dados: Array<{ placar: string; quantidade: number }> }) {
  if (dados.length === 0) return null;
  return (
    <div className="bg-gray-800/60 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">🎲 Placares mais apostados</h3>
      <div style={{ height: dados.length * 32 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 32 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="placar"
              width={40}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="quantidade"
              fill="#facc15"
              radius={[0, 4, 4, 0]}
              label={{ position: 'right', fill: '#e5e7eb', fontSize: 12 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-trovao-muted mt-1">Palpites do bolão em jogos publicados</p>
    </div>
  );
}
