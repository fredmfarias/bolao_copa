'use client';

import type { Jogo, Aposta } from '@/types/api';

interface Props {
  jogo: Jogo;
  aposta?: Aposta;
  bolaoId?: string;
  onApostar?: (jogoId: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function JogoCard({ jogo, aposta, bolaoId, onApostar }: Props) {
  const fechado = new Date() >= new Date(new Date(jogo.dataHora).getTime() - 60 * 60 * 1000);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>{jogo.fase} {jogo.grupo ? `· Grupo ${jogo.grupo}` : ''} · Rodada {jogo.rodada}</span>
        <span>{formatDate(jogo.dataHora)}</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <p className="font-semibold">{jogo.selecaoCasa.nome}</p>
          <p className="text-xs text-gray-500">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="text-center min-w-[60px]">
          {jogo.placarCasa !== null ? (
            <span className="text-2xl font-bold text-yellow-400">
              {jogo.placarCasa} x {jogo.placarVisitante}
            </span>
          ) : (
            <span className="text-gray-600 text-sm">vs</span>
          )}
        </div>

        <div className="flex-1 text-left">
          <p className="font-semibold">{jogo.selecaoVisitante.nome}</p>
          <p className="text-xs text-gray-500">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {aposta && (
        <div className="text-xs text-center text-gray-400 border-t border-gray-800 pt-2">
          Sua aposta: {aposta.placarCasa} x {aposta.placarVisitante}
          {aposta.pontuacao !== null && (
            <span className="ml-2 text-yellow-400 font-bold">+{aposta.pontuacao} pts</span>
          )}
        </div>
      )}

      {bolaoId && onApostar && !fechado && (
        <button onClick={() => onApostar(jogo.id)}
          className="w-full text-xs bg-yellow-400 text-gray-900 font-bold py-1.5 rounded-lg hover:bg-yellow-300">
          {aposta ? 'Editar aposta' : 'Apostar'}
        </button>
      )}

      {bolaoId && fechado && !aposta && (
        <p className="text-xs text-center text-gray-600">Prazo encerrado</p>
      )}
    </div>
  );
}
