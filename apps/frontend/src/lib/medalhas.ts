// Destaque metálico dos 5 primeiros colocados. Classes literais para o
// Tailwind não fazer purge (nada de montar `border-trovao-${metal}`).
export const MEDALHAS: Record<number, { border: string; texto: string }> = {
  1: { border: 'border-trovao-gold/70',   texto: 'text-trovao-gold'      },
  2: { border: 'border-trovao-silver/70', texto: 'text-trovao-silver'    },
  3: { border: 'border-trovao-bronze/70', texto: 'text-trovao-bronze'    },
  // 4º e 5º: degradê esmaecido do bronze.
  4: { border: 'border-trovao-bronze/45', texto: 'text-trovao-bronze/80' },
  5: { border: 'border-trovao-bronze/25', texto: 'text-trovao-bronze/55' },
};
