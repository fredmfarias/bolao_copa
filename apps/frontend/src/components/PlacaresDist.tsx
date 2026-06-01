'use client';

import { useState } from 'react';
import {
  FASES_ELIMINATORIAS,
  MAX_APOSTAS_IGUAIS_GRUPOS,
  MAX_APOSTAS_IGUAIS_ELIMINATORIAS,
  JogoFase,
} from '@bolao/shared';
import type { Aposta, Jogo } from '@/types/api';
import { prazoEncerrado } from '@/lib/jogoEstado';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { EmptyState } from '@/components/EmptyState';

interface PlacasDistProps {
  apostas: Aposta[];
  onApostar: (jogo: Jogo) => void;
}

type PlacarGrupo = {
  placarAlto: number;
  placarBaixo: number;
  apostas: Aposta[];
};

function agruparPorPlacar(apostas: Aposta[]): PlacarGrupo[] {
  const map = new Map<string, Aposta[]>();
  for (const a of apostas) {
    const alto = Math.max(a.placarCasa, a.placarVisitante);
    const baixo = Math.min(a.placarCasa, a.placarVisitante);
    const key = `${alto}-${baixo}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.values())
    .map(lista => ({
      placarAlto: Math.max(lista[0].placarCasa, lista[0].placarVisitante),
      placarBaixo: Math.min(lista[0].placarCasa, lista[0].placarVisitante),
      apostas: lista,
    }))
    .sort((a, b) => a.placarAlto - b.placarAlto || a.placarBaixo - b.placarBaixo);
}

function barraColor(count: number, limite: number): string {
  const pct = count / limite;
  if (pct >= 1)    return 'bg-red-500';
  if (pct >= 0.75) return 'bg-trovao-gold';
  return 'bg-gray-600';
}

interface PlacarDistRowProps {
  grupo: PlacarGrupo;
  limite: number;
  onApostar: (jogo: Jogo) => void;
}


function PlacarDistRow({ grupo, limite, onApostar }: PlacarDistRowProps) {
  const [expandido, setExpandido] = useState(false);
  const count = grupo.apostas.length;
  const pct   = Math.min((count / limite) * 100, 100);

  return (
    <div className="border border-trovao-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandido(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-trovao-surface/50 transition-colors"
      >
        <span className="text-white font-bold tabular-nums w-14 text-left shrink-0">
          {grupo.placarAlto} × {grupo.placarBaixo}
        </span>
        <div className="flex-1 h-2 bg-trovao-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barraColor(count, limite)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-trovao-muted text-xs tabular-nums w-10 text-right shrink-0">
          {count}/{limite}
        </span>
        <span className="text-trovao-muted text-xs shrink-0">
          {expandido ? '˄' : '˅'}
        </span>
      </button>

      {expandido && (
        <div className="divide-y divide-trovao-border">
          {grupo.apostas.map(aposta => {
            const aberto = !prazoEncerrado(aposta.jogo);
            return (
              <div key={aposta.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  <SelecaoAvatar
                    nome={aposta.jogo.selecaoCasa.nome}
                    bandeiraSvg={aposta.jogo.selecaoCasa.bandeiraSvg}
                    size="sm"
                  />
                  <span className="text-xs text-trovao-muted">{aposta.jogo.selecaoCasa.codigo}</span>
                  <span className="text-xs text-trovao-muted">×</span>
                  <span className="text-xs text-trovao-muted">{aposta.jogo.selecaoVisitante.codigo}</span>
                  <SelecaoAvatar
                    nome={aposta.jogo.selecaoVisitante.nome}
                    bandeiraSvg={aposta.jogo.selecaoVisitante.bandeiraSvg}
                    size="sm"
                  />
                </div>
                <span className="text-xs text-trovao-muted flex-1 min-w-0 truncate">
                  {new Date(aposta.jogo.dataHora).toLocaleDateString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: '2-digit',
                  })}
                  {' · '}
                  {new Date(aposta.jogo.dataHora).toLocaleTimeString('pt-BR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <div className="text-xs shrink-0">
                  {aberto ? (
                    <button
                      onClick={() => onApostar(aposta.jogo)}
                      className="text-trovao-gold hover:underline font-semibold"
                    >
                      Editar
                    </button>
                  ) : aposta.pontuacao !== null ? (
                    <span className="text-white">+{aposta.pontuacao} pts</span>
                  ) : (
                    <span className="text-trovao-muted">Aguardando</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlacaresDist({ apostas, onApostar }: PlacasDistProps) {
  const apostasGrupos = apostas.filter(
    a => !FASES_ELIMINATORIAS.includes(a.jogo.fase as JogoFase),
  );
  const apostasElim = apostas.filter(
    a => FASES_ELIMINATORIAS.includes(a.jogo.fase as JogoFase),
  );

  const gruposDistribuicao = agruparPorPlacar(apostasGrupos);
  const elimDistribuicao   = agruparPorPlacar(apostasElim);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Fase de Grupos</h2>
          <span className="text-xs text-trovao-muted">
            limite: {MAX_APOSTAS_IGUAIS_GRUPOS} apostas idênticas
          </span>
        </div>
        {gruposDistribuicao.length === 0 ? (
          <EmptyState
            titulo="Nenhum palpite"
            descricao="Nenhum palpite na fase de grupos ainda."
          />
        ) : (
          <div className="space-y-2">
            {gruposDistribuicao.map(g => (
              <PlacarDistRow
                key={`${g.placarAlto}-${g.placarBaixo}`}
                grupo={g}
                limite={MAX_APOSTAS_IGUAIS_GRUPOS}
                onApostar={onApostar}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Fases Eliminatórias</h2>
          <span className="text-xs text-trovao-muted">
            limite: {MAX_APOSTAS_IGUAIS_ELIMINATORIAS} apostas idênticas
          </span>
        </div>
        {elimDistribuicao.length === 0 ? (
          <EmptyState
            titulo="Nenhum palpite"
            descricao="Nenhum palpite nas fases eliminatórias ainda."
          />
        ) : (
          <div className="space-y-2">
            {elimDistribuicao.map(g => (
              <PlacarDistRow
                key={`${g.placarAlto}-${g.placarBaixo}`}
                grupo={g}
                limite={MAX_APOSTAS_IGUAIS_ELIMINATORIAS}
                onApostar={onApostar}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
