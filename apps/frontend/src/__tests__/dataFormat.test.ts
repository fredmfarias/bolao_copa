import { formatDataPublicacao } from '@/lib/dataFormat';

it('formata ISO em dd/mm/yyyy', () => {
  // Construir Date local pra evitar diferença de timezone:
  const d = new Date(2026, 4 /* maio */, 26, 10, 0, 0);
  expect(formatDataPublicacao(d.toISOString())).toBe('26/05/2026');
});

it('pad zero em dia/mês', () => {
  const d = new Date(2026, 0, 3);
  expect(formatDataPublicacao(d.toISOString())).toBe('03/01/2026');
});
