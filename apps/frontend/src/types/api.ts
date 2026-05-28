export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  ativo?: boolean;
  criadoEm: string;
  bolaoFavoritoId?: string | null;
}

export interface Bolao {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ATIVO' | 'INATIVO';
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
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  atualizadoEm: string;
  jogo: Jogo;
}

export interface RankingEntry {
  id: string;
  usuarioId: string;
  posicao: number;
  posicoesGanhas: number;
  pontuacaoTotal: number;
  pontuacaoRodada: number;
  acertosPlacarExato: number;
  acertosPlacarVencedor: number;
  acertosPlacarPerdedor: number;
  acertosEmpate: number;
  acertosGanhador: number;
  acertosNada: number;
  apostasPostadas: number;
  usuario: { id: string; nome: string; avatarUrl: string | null };
}

export interface PublicacaoResumo {
  numero: number;
  publicadoEm: string;
}

export interface EvolucaoPonto {
  numero: number;
  posicao: number;
}

export interface AdminBolao {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ATIVO' | 'INATIVO';
  precoReais: string;
  maxParticipantes: number;
  _count: { membros: number };
}

export interface AdminUsuario {
  id: string;
  nome: string;
  email: string;
  role: 'ADMIN' | 'USER';
  ativo: boolean;
  avatarUrl: string | null;
  criadoEm: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface UserSearchResult {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
}
