import type { Jogo, Aposta } from '@/types/api';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

export type EstadoAposta =
  | 'aberto' | 'salvo' | 'aguardando' | 'finalizado' | 'sem-palpite';

export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados' | 'Placares';

export function prazoEncerrado(jogo: Jogo): boolean {
  const prazo = new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000;
  return Date.now() >= prazo;
}

export function getEstadoAposta(jogo: Jogo, aposta?: Aposta): EstadoAposta {
  const prazo = prazoEncerrado(jogo);
  const temPlacar = jogo.placarCasa !== null && jogo.placarVisitante !== null;
  if (!prazo && !aposta) return 'aberto';
  if (!prazo && aposta)  return 'salvo';
  if (!aposta)           return 'sem-palpite';
  if (temPlacar)         return 'finalizado';
  return 'aguardando';
}

export function jogoNoFiltro(estado: EstadoAposta, filtro: FiltroJogo): boolean {
  switch (filtro) {
    case 'Todos':      return true;
    case 'Pendentes':  return estado === 'aberto';
    case 'Apostados':  return estado === 'salvo';
    case 'Encerrados': return estado === 'aguardando' || estado === 'finalizado' || estado === 'sem-palpite';
    case 'Placares':   return false;
  }
}

export function ordenarPorFiltro(jogos: Jogo[], filtro: FiltroJogo): Jogo[] {
  const ordenado = [...jogos].sort(
    (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
  );
  return filtro === 'Encerrados' ? ordenado.reverse() : ordenado;
}

export function formatDataAposta(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
