export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  criadoEm: string;
}

export interface Bolao {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ATIVO' | 'PAGO' | 'ARQUIVADO';
  escopo: 'GRUPOS' | 'ELIMINATORIAS' | 'AMBOS';
  maxParticipantes: number;
  precoReais: string;
  _count?: { membros: number };
  membros?: BolaoMembro[];
}

export interface BolaoMembro {
  id: string;
  usuarioId: string;
  papel: 'MODERADOR' | 'PARTICIPANTE';
  usuario: { id: string; nome: string; avatarUrl: string | null };
}

export interface Selecao {
  id: string;
  nome: string;
  codigo: string;
  bandeiraSvg: string;
}

export interface Jogo {
  id: string;
  dataHora: string;
  rodada: number;
  grupo: string | null;
  fase: string;
  placarCasa: number | null;
  placarVisitante: number | null;
  pesoPontuacao: number;
  selecaoCasa: Selecao;
  selecaoVisitante: Selecao;
}

export interface Aposta {
  id: string;
  jogoId: string;
  bolaoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  jogo: Jogo;
}

export interface RankingEntry {
  id: string;
  usuarioId: string;
  posicao: number;
  pontuacaoTotal: number;
  acertosPlacarExato: number;
  acertosPlacarVencedor: number;
  acertosEmpate: number;
  acertosGanhador: number;
  apostasPostadas: number;
  usuario: { id: string; nome: string; avatarUrl: string | null };
}

export interface AuthTokens {
  accessToken: string;
}
