import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        trovao: {
          base:    '#071A0E',
          card:    '#0D2A1C',
          gold:    '#FFD600',
          green:   '#22C55E',
          red:     '#EF4444',
          border:  '#1E3A2A',
          muted:   '#94A3B8',
          surface: '#0F2318',
          // Destaque metálico do top 5 no ranking (gold = 1º, prata = 2º,
          // bronze = 3º; 4º e 5º são degradês esmaecidos do bronze via opacidade)
          silver:  '#C0C8D4',
          bronze:  '#CD7F32',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
