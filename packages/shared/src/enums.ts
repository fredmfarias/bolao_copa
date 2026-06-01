export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum BolaoStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}

export enum JogoFase {
  GRUPOS = 'GRUPOS',
  SEGUNDA_FASE = 'SEGUNDA_FASE',
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

export enum StatusPagamento {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
}

export const FASES_ELIMINATORIAS: JogoFase[] = [
  JogoFase.SEGUNDA_FASE,
  JogoFase.OITAVAS,
  JogoFase.QUARTAS,
  JogoFase.SEMIS,
  JogoFase.TERCEIRO_LUGAR,
  JogoFase.FINAL,
];

export const MAX_APOSTAS_IGUAIS_GRUPOS = 18;
export const MAX_APOSTAS_IGUAIS_ELIMINATORIAS = 8;
export const MINUTOS_PRAZO_APOSTA = 60;
export const BOLAO_GLOBAL_ID = '00000000-0000-0000-0000-000000000001';
export const HORAS_CORTE_INSCRICAO = 2;
