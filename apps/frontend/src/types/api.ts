export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone: string;
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
  statusPagamento: 'PENDENTE' | 'PAGO';
  usuario: { id: string; nome: string; avatarUrl: string | null };
}

export interface Selecao {
  id: string;
  nome: string;
  codigo: string;
  bandeiraSvg: string;
  grupo?: string;
}

export interface Estadio {
  id: string;
  nome: string;
  cidade: string;
  pais: string;
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
  publicacaoId: string | null;
  selecaoCasa: Selecao;
  selecaoVisitante: Selecao;
  estadio?: Estadio;
}

export interface Aposta {
  id: string;
  jogoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  palpiteAtualizadoEm: string;
  jogo: Jogo;
}

export interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  palpiteAtualizadoEm: string;
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
  aproveitamento: number;
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

export interface JogoPendente {
  id: string;
  dataHora: string;
  rodada: number;
  fase: string;
  pesoPontuacao: number;
  placarCasa: number;
  placarVisitante: number;
  selecaoCasa:      { nome: string; codigo: string; bandeiraSvg: string };
  selecaoVisitante: { nome: string; codigo: string; bandeiraSvg: string };
}

export interface RodadaPalpiteItem {
  jogo: {
    id: string;
    dataHora: string;
    pesoPontuacao: number;
    placarCasa: number;
    placarVisitante: number;
    selecaoCasa:      { nome: string; codigo: string; bandeiraSvg: string };
    selecaoVisitante: { nome: string; codigo: string; bandeiraSvg: string };
  };
  palpite: { placarCasa: number; placarVisitante: number } | null;
  pontuacao: number;
}

export interface UsuarioPalpitesRodada {
  publicacao: { numero: number; publicadoEm: string };
  items: RodadaPalpiteItem[];
}

// --- Estatísticas do bolão ---

export type UsuarioRef = { id: string; nome: string; avatarUrl: string | null };
export type TopEntry = { usuarios: UsuarioRef[]; valor: number };
export type RecordeRodada = {
  valor: number;
  registros: Array<{ usuario: UsuarioRef; publicacao: number }>;
};

export type EstatisticasBolao =
  | { temDados: false }
  | {
      temDados: true;
      ultimaPublicacao: { numero: number; publicadoEm: string };
      posicoes: {
        reiDaLideranca: TopEntry[];
        lanterna: TopEntry[];
        foguete: RecordeRodada | null;
        quedaLivre: RecordeRodada | null;
        maisRegular: { usuarios: UsuarioRef[]; valor: number } | null;
        top5: TopEntry[];
      };
      recordes: {
        maiorPontuacaoRodada: RecordeRodada | null;
        rodadaGenerosa: { publicacao: number; media: number } | null;
        rodadaAvara: { publicacao: number; media: number } | null;
        reiDoPlacarExato: TopEntry[];
        aproveitamentoPorFase: Array<{
          fase: string;
          aproveitamento: number;
          melhor: { usuarios: UsuarioRef[]; pontos: number } | null;
        }>;
      };
      palpites: {
        placaresMaisApostados: Array<{ placar: string; quantidade: number }>;
        jogoConsensual: { jogo: string; placar: string; percentual: number } | null;
        jogoDividido: { jogo: string; placaresDistintos: number; percentualModal: number } | null;
        otimista: { usuarios: UsuarioRef[]; mediaGols: number } | null;
        pessimista: { usuarios: UsuarioRef[]; mediaGols: number } | null;
        mediaRealGols: number | null;
        ultimaHora: { usuarios: UsuarioRef[]; medianaMinutos: number } | null;
        precavido: { usuarios: UsuarioRef[]; medianaMinutos: number } | null;
        reenvios: TopEntry[];
        empates: { percentualApostas: number; percentualJogos: number } | null;
        esquecidos: TopEntry[];
      };
      zebras: {
        zebra: { jogo: string; percentualPontuaram: number } | null;
        previsivel: { jogo: string; percentualPontuaram: number } | null;
        acertosSolitarios: Array<{ jogo: string; usuario: UsuarioRef; placar: string }>;
      };
    };
