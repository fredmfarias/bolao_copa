export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum BolaoStatus {
  ATIVO = 'ATIVO',
  PAGO = 'PAGO',
  ARQUIVADO = 'ARQUIVADO',
}

export enum BolaoEscopo {
  GRUPOS = 'GRUPOS',
  ELIMINATORIAS = 'ELIMINATORIAS',
  AMBOS = 'AMBOS',
}

export enum JogoFase {
  GRUPOS = 'GRUPOS',
  OITAVAS = 'OITAVAS',
  QUARTAS = 'QUARTAS',
  SEMIS = 'SEMIS',
  TERCEIRO_LUGAR = 'TERCEIRO_LUGAR',
  FINAL = 'FINAL',
}

export enum BolaoMembroPapel {
  MODERADOR = 'MODERADOR',
  PARTICIPANTE = 'PARTICIPANTE',
}

export const FASES_ELIMINATORIAS: JogoFase[] = [
  JogoFase.OITAVAS,
  JogoFase.QUARTAS,
  JogoFase.SEMIS,
  JogoFase.TERCEIRO_LUGAR,
  JogoFase.FINAL,
];

export const MAX_APOSTAS_IGUAIS_GRUPOS = 25;
export const MAX_APOSTAS_IGUAIS_ELIMINATORIAS = 8;
export const MINUTOS_PRAZO_APOSTA = 60;
export const BOLAO_GLOBAL_ID = '00000000-0000-0000-0000-000000000001';
