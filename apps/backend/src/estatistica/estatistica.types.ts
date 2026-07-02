export type UserRef = { id: string; nome: string; avatarUrl: string | null };

/** Linha de ranking informal: usuários empatados num mesmo valor. */
export type TopEntry = { usuarios: UserRef[]; valor: number };

/** Recorde ligado a uma rodada: pode haver empate entre (usuário, rodada). */
export type RecordeRodada = {
  valor: number;
  registros: Array<{ usuario: UserRef; publicacao: number }>;
};

// ---- Inputs normalizados (desacoplados do Prisma) para as calculadoras puras ----

export type SnapshotInput = {
  usuarioId: string;
  publicacaoNumero: number;
  posicao: number;
  posicoesGanhas: number;
  pontuacaoRodada: number;
  acertosPlacarExato: number;
};

export type JogoInput = {
  id: string;
  dataHora: Date;
  fase: string;
  pesoPontuacao: number;
  placarCasa: number;
  placarVisitante: number;
  /** "Brasil x França" — pronto para exibição. */
  descricao: string;
};

export type ApostaInput = {
  usuarioId: string;
  jogoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  criadoEm: Date;
  palpiteAtualizadoEm: Date;
};

// ---- Payload ----

export type Posicoes = {
  reiDaLideranca: TopEntry[]; // top 3
  lanterna: TopEntry[]; // top 3
  foguete: RecordeRodada | null;
  quedaLivre: RecordeRodada | null;
  maisRegular: { usuarios: UserRef[]; valor: number } | null; // desvio padrão, 2 casas
  top5: TopEntry[]; // top 3
};

export type Recordes = {
  maiorPontuacaoRodada: RecordeRodada | null;
  rodadaGenerosa: { publicacao: number; media: number } | null;
  rodadaAvara: { publicacao: number; media: number } | null;
  reiDoPlacarExato: TopEntry[]; // top 3, snapshot da última publicação
  aproveitamentoPorFase: Array<{
    fase: string;
    aproveitamento: number; // 0–100
    melhor: { usuarios: UserRef[]; pontos: number } | null;
  }>;
};

export type Palpites = {
  placaresMaisApostados: Array<{ placar: string; quantidade: number }>; // top 8
  jogoConsensual: { jogo: string; placar: string; percentual: number } | null;
  jogoDividido: { jogo: string; placaresDistintos: number; percentualModal: number } | null;
  otimista: { usuarios: UserRef[]; mediaGols: number } | null;
  pessimista: { usuarios: UserRef[]; mediaGols: number } | null;
  mediaRealGols: number | null;
  ultimaHora: { usuarios: UserRef[]; medianaMinutos: number } | null;
  precavido: { usuarios: UserRef[]; medianaMinutos: number } | null;
  reenvios: TopEntry[]; // top 3
  empates: { percentualApostas: number; percentualJogos: number } | null;
  esquecidos: TopEntry[]; // top 3
};

export type Zebras = {
  zebra: { jogo: string; percentualPontuaram: number } | null;
  previsivel: { jogo: string; percentualPontuaram: number } | null;
  acertosSolitarios: Array<{ jogo: string; usuario: UserRef; placar: string }>; // até 10
};

export type EstatisticasBolao =
  | { temDados: false }
  | {
      temDados: true;
      ultimaPublicacao: { numero: number; publicadoEm: Date };
      posicoes: Posicoes;
      recordes: Recordes;
      palpites: Palpites;
      zebras: Zebras;
    };
