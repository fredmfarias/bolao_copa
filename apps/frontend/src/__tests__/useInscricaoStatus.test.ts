import { renderHook, waitFor } from '@testing-library/react';
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  fetchMock.mockReset();
  sessionStorage.clear();
});

it('retorna abertas=true enquanto carrega', () => {
  fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
  const { result } = renderHook(() => useInscricaoStatus());
  expect(result.current.abertas).toBe(true);
  expect(result.current.loading).toBe(true);
});

it('atualiza para abertas=false quando API retorna false', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ abertas: false, dataCorte: '2026-06-11T18:00:00.000Z' }),
  });
  const { result } = renderHook(() => useInscricaoStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.abertas).toBe(false);
});

it('lê do sessionStorage quando entrada ainda é válida', async () => {
  sessionStorage.setItem(
    'inscricao-status',
    JSON.stringify({ value: { abertas: false, dataCorte: null }, expiresAt: Date.now() + 30_000 }),
  );
  const { result } = renderHook(() => useInscricaoStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.abertas).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('faz fetch quando entrada do sessionStorage expirou', async () => {
  sessionStorage.setItem(
    'inscricao-status',
    JSON.stringify({ value: { abertas: false, dataCorte: null }, expiresAt: Date.now() - 1_000 }),
  );
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ abertas: true, dataCorte: null }),
  });
  const { result } = renderHook(() => useInscricaoStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.abertas).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
