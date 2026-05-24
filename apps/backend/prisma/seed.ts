import { PrismaClient, BolaoStatus, BolaoEscopo, Role, JogoFase } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_ID = '00000000-0000-0000-0000-000000000000';
const BOLAO_GLOBAL_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  await prisma.usuario.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      nome: 'Administrador',
      email: 'admin@bolao.com',
      role: Role.ADMIN,
      emailVerificado: true,
      senhaHash: null,
    },
  });

  await prisma.bolao.upsert({
    where: { id: BOLAO_GLOBAL_ID },
    update: {},
    create: {
      id: BOLAO_GLOBAL_ID,
      nome: 'Bolão Global — Copa 2026',
      descricao: 'Bolão público. Todos os participantes entram automaticamente.',
      status: BolaoStatus.PAGO,
      escopo: BolaoEscopo.AMBOS,
      maxParticipantes: 99999,
      precoReais: 0,
      criadoPorId: ADMIN_ID,
    },
  });

  const niveis = [
    { nivel: 1, descricao: 'Placar exato',                       pontos: 10 },
    { nivel: 2, descricao: 'Placar do vencedor correto',         pontos: 6  },
    { nivel: 3, descricao: 'Empate correto (sem placar exato)',  pontos: 5  },
    { nivel: 4, descricao: 'Placar do perdedor correto',         pontos: 3  },
    { nivel: 5, descricao: 'Acertou apenas o vencedor',          pontos: 2  },
  ];
  for (const n of niveis) {
    await prisma.configuracaoPontuacao.upsert({
      where: { nivel: n.nivel },
      update: {},
      create: { ...n, atualizadoPorId: ADMIN_ID },
    });
  }

  // Limpar dados de referência antes de recriar (garante idempotência com troca de códigos)
  await prisma.aposta.deleteMany();
  await prisma.jogo.deleteMany();
  await prisma.selecao.deleteMany();
  await prisma.estadio.deleteMany();

  // Estádios — nomes da API Globo Esporte (sede.nome_popular)
  await prisma.estadio.createMany({
    data: [
      { nome: 'Azteca',              cidade: 'Cidade do México', pais: 'México' },
      { nome: 'Akron',               cidade: 'Guadalajara',      pais: 'México' },
      { nome: 'El Gigante de Acero', cidade: 'Monterrey',        pais: 'México' },
      { nome: 'Toronto Field',       cidade: 'Toronto',          pais: 'Canadá' },
      { nome: 'Vancouver Place',     cidade: 'Vancouver',        pais: 'Canadá' },
      { nome: 'Nova Jersey',         cidade: 'East Rutherford',  pais: 'EUA'    },
      { nome: 'Los Angeles',         cidade: 'Los Angeles',      pais: 'EUA'    },
      { nome: 'Santa Clara',         cidade: 'Santa Clara',      pais: 'EUA'    },
      { nome: 'Dallas',              cidade: 'Dallas',           pais: 'EUA'    },
      { nome: 'Houston',             cidade: 'Houston',          pais: 'EUA'    },
      { nome: 'Miami',               cidade: 'Miami',            pais: 'EUA'    },
      { nome: 'Atlanta',             cidade: 'Atlanta',          pais: 'EUA'    },
      { nome: 'Seattle Field',       cidade: 'Seattle',          pais: 'EUA'    },
      { nome: 'Filadélfia',          cidade: 'Filadélfia',       pais: 'EUA'    },
      { nome: 'Boston',              cidade: 'Boston',           pais: 'EUA'    },
      { nome: 'Kansas City',         cidade: 'Kansas City',      pais: 'EUA'    },
    ],
  });
  const estadioRows = await prisma.estadio.findMany({ select: { id: true, nome: true } });
  const estadioMap: Record<string, string> = Object.fromEntries(estadioRows.map(e => [e.nome, e.id]));

  // Seleções — siglas da API Globo Esporte, grupos reais do sorteio
  await prisma.selecao.createMany({
    data: [
      // Grupo A
      { nome: 'México',           codigo: 'MEX', grupo: 'A', bandeiraSvg: '/flags/MEX.svg' },
      { nome: 'África do Sul',    codigo: 'AFS', grupo: 'A', bandeiraSvg: '/flags/AFS.svg' },
      { nome: 'Coreia do Sul',    codigo: 'COR', grupo: 'A', bandeiraSvg: '/flags/COR.svg' },
      { nome: 'República Tcheca', codigo: 'TCH', grupo: 'A', bandeiraSvg: '/flags/TCH.svg' },
      // Grupo B
      { nome: 'Canadá',           codigo: 'CAN', grupo: 'B', bandeiraSvg: '/flags/CAN.svg' },
      { nome: 'Bósnia',           codigo: 'BOS', grupo: 'B', bandeiraSvg: '/flags/BOS.svg' },
      { nome: 'Catar',            codigo: 'CAT', grupo: 'B', bandeiraSvg: '/flags/CAT.svg' },
      { nome: 'Suíça',            codigo: 'SUI', grupo: 'B', bandeiraSvg: '/flags/SUI.svg' },
      // Grupo C
      { nome: 'Brasil',           codigo: 'BRA', grupo: 'C', bandeiraSvg: '/flags/BRA.svg' },
      { nome: 'Marrocos',         codigo: 'MAR', grupo: 'C', bandeiraSvg: '/flags/MAR.svg' },
      { nome: 'Haiti',            codigo: 'HAI', grupo: 'C', bandeiraSvg: '/flags/HAI.svg' },
      { nome: 'Escócia',          codigo: 'ESC', grupo: 'C', bandeiraSvg: '/flags/ESC.svg' },
      // Grupo D
      { nome: 'Estados Unidos',   codigo: 'EUA', grupo: 'D', bandeiraSvg: '/flags/EUA.svg' },
      { nome: 'Paraguai',         codigo: 'PAR', grupo: 'D', bandeiraSvg: '/flags/PAR.svg' },
      { nome: 'Austrália',        codigo: 'AUS', grupo: 'D', bandeiraSvg: '/flags/AUS.svg' },
      { nome: 'Turquia',          codigo: 'TUR', grupo: 'D', bandeiraSvg: '/flags/TUR.svg' },
      // Grupo E
      { nome: 'Alemanha',         codigo: 'ALE', grupo: 'E', bandeiraSvg: '/flags/ALE.svg' },
      { nome: 'Curaçao',          codigo: 'CUR', grupo: 'E', bandeiraSvg: '/flags/CUR.svg' },
      { nome: 'Costa do Marfim',  codigo: 'CDM', grupo: 'E', bandeiraSvg: '/flags/CDM.svg' },
      { nome: 'Equador',          codigo: 'EQU', grupo: 'E', bandeiraSvg: '/flags/EQU.svg' },
      // Grupo F
      { nome: 'Holanda',          codigo: 'HOL', grupo: 'F', bandeiraSvg: '/flags/HOL.svg' },
      { nome: 'Japão',            codigo: 'JAP', grupo: 'F', bandeiraSvg: '/flags/JAP.svg' },
      { nome: 'Suécia',           codigo: 'SUE', grupo: 'F', bandeiraSvg: '/flags/SUE.svg' },
      { nome: 'Tunísia',          codigo: 'TUN', grupo: 'F', bandeiraSvg: '/flags/TUN.svg' },
      // Grupo G
      { nome: 'Bélgica',          codigo: 'BEL', grupo: 'G', bandeiraSvg: '/flags/BEL.svg' },
      { nome: 'Egito',            codigo: 'EGI', grupo: 'G', bandeiraSvg: '/flags/EGI.svg' },
      { nome: 'Irã',              codigo: 'IRA', grupo: 'G', bandeiraSvg: '/flags/IRA.svg' },
      { nome: 'Nova Zelândia',    codigo: 'NZE', grupo: 'G', bandeiraSvg: '/flags/NZE.svg' },
      // Grupo H
      { nome: 'Espanha',          codigo: 'ESP', grupo: 'H', bandeiraSvg: '/flags/ESP.svg' },
      { nome: 'Cabo Verde',       codigo: 'CAB', grupo: 'H', bandeiraSvg: '/flags/CAB.svg' },
      { nome: 'Arábia Saudita',   codigo: 'ARS', grupo: 'H', bandeiraSvg: '/flags/ARS.svg' },
      { nome: 'Uruguai',          codigo: 'URU', grupo: 'H', bandeiraSvg: '/flags/URU.svg' },
      // Grupo I
      { nome: 'França',           codigo: 'FRA', grupo: 'I', bandeiraSvg: '/flags/FRA.svg' },
      { nome: 'Senegal',          codigo: 'SEN', grupo: 'I', bandeiraSvg: '/flags/SEN.svg' },
      { nome: 'Iraque',           codigo: 'IRQ', grupo: 'I', bandeiraSvg: '/flags/IRQ.svg' },
      { nome: 'Noruega',          codigo: 'NOR', grupo: 'I', bandeiraSvg: '/flags/NOR.svg' },
      // Grupo J
      { nome: 'Argentina',        codigo: 'ARG', grupo: 'J', bandeiraSvg: '/flags/ARG.svg' },
      { nome: 'Argélia',          codigo: 'AGL', grupo: 'J', bandeiraSvg: '/flags/AGL.svg' },
      { nome: 'Áustria',          codigo: 'AUT', grupo: 'J', bandeiraSvg: '/flags/AUT.svg' },
      { nome: 'Jordânia',         codigo: 'JOR', grupo: 'J', bandeiraSvg: '/flags/JOR.svg' },
      // Grupo K
      { nome: 'Portugal',         codigo: 'POR', grupo: 'K', bandeiraSvg: '/flags/POR.svg' },
      { nome: 'RD Congo',         codigo: 'RDC', grupo: 'K', bandeiraSvg: '/flags/RDC.svg' },
      { nome: 'Uzbequistão',      codigo: 'UZB', grupo: 'K', bandeiraSvg: '/flags/UZB.svg' },
      { nome: 'Colômbia',         codigo: 'COL', grupo: 'K', bandeiraSvg: '/flags/COL.svg' },
      // Grupo L
      { nome: 'Inglaterra',       codigo: 'ING', grupo: 'L', bandeiraSvg: '/flags/ING.svg' },
      { nome: 'Croácia',          codigo: 'CRO', grupo: 'L', bandeiraSvg: '/flags/CRO.svg' },
      { nome: 'Gana',             codigo: 'GAN', grupo: 'L', bandeiraSvg: '/flags/GAN.svg' },
      { nome: 'Panamá',           codigo: 'PAN', grupo: 'L', bandeiraSvg: '/flags/PAN.svg' },
    ],
  });
  const selecaoRows = await prisma.selecao.findMany({ select: { id: true, codigo: true } });
  const selecaoMap: Record<string, string> = Object.fromEntries(selecaoRows.map(s => [s.codigo, s.id]));

  // Jogos — 72 jogos da fase de grupos (horários de Brasília, UTC-3)
  type JogoRaw = { dataHora: Date; casa: string; visitante: string; estadio: string; rodada: number; grupo: string };
  const jogosRaw: JogoRaw[] = [
    // Rodada 1
    { dataHora: new Date('2026-06-11T16:00:00-03:00'), casa: 'MEX', visitante: 'AFS', estadio: 'Azteca',              rodada: 1, grupo: 'A' },
    { dataHora: new Date('2026-06-11T23:00:00-03:00'), casa: 'COR', visitante: 'TCH', estadio: 'Akron',               rodada: 1, grupo: 'A' },
    { dataHora: new Date('2026-06-12T16:00:00-03:00'), casa: 'CAN', visitante: 'BOS', estadio: 'Toronto Field',       rodada: 1, grupo: 'B' },
    { dataHora: new Date('2026-06-12T22:00:00-03:00'), casa: 'EUA', visitante: 'PAR', estadio: 'Los Angeles',         rodada: 1, grupo: 'D' },
    { dataHora: new Date('2026-06-13T16:00:00-03:00'), casa: 'CAT', visitante: 'SUI', estadio: 'Santa Clara',         rodada: 1, grupo: 'B' },
    { dataHora: new Date('2026-06-13T19:00:00-03:00'), casa: 'BRA', visitante: 'MAR', estadio: 'Nova Jersey',         rodada: 1, grupo: 'C' },
    { dataHora: new Date('2026-06-13T22:00:00-03:00'), casa: 'HAI', visitante: 'ESC', estadio: 'Boston',              rodada: 1, grupo: 'C' },
    { dataHora: new Date('2026-06-14T01:00:00-03:00'), casa: 'AUS', visitante: 'TUR', estadio: 'Vancouver Place',     rodada: 1, grupo: 'D' },
    { dataHora: new Date('2026-06-14T14:00:00-03:00'), casa: 'ALE', visitante: 'CUR', estadio: 'Houston',             rodada: 1, grupo: 'E' },
    { dataHora: new Date('2026-06-14T17:00:00-03:00'), casa: 'HOL', visitante: 'JAP', estadio: 'Dallas',              rodada: 1, grupo: 'F' },
    { dataHora: new Date('2026-06-14T20:00:00-03:00'), casa: 'CDM', visitante: 'EQU', estadio: 'Filadélfia',          rodada: 1, grupo: 'E' },
    { dataHora: new Date('2026-06-14T23:00:00-03:00'), casa: 'SUE', visitante: 'TUN', estadio: 'El Gigante de Acero', rodada: 1, grupo: 'F' },
    { dataHora: new Date('2026-06-15T13:00:00-03:00'), casa: 'ESP', visitante: 'CAB', estadio: 'Atlanta',             rodada: 1, grupo: 'H' },
    { dataHora: new Date('2026-06-15T16:00:00-03:00'), casa: 'BEL', visitante: 'EGI', estadio: 'Seattle Field',       rodada: 1, grupo: 'G' },
    { dataHora: new Date('2026-06-15T19:00:00-03:00'), casa: 'ARS', visitante: 'URU', estadio: 'Miami',               rodada: 1, grupo: 'H' },
    { dataHora: new Date('2026-06-15T22:00:00-03:00'), casa: 'IRA', visitante: 'NZE', estadio: 'Los Angeles',         rodada: 1, grupo: 'G' },
    { dataHora: new Date('2026-06-16T16:00:00-03:00'), casa: 'FRA', visitante: 'SEN', estadio: 'Nova Jersey',         rodada: 1, grupo: 'I' },
    { dataHora: new Date('2026-06-16T19:00:00-03:00'), casa: 'IRQ', visitante: 'NOR', estadio: 'Boston',              rodada: 1, grupo: 'I' },
    { dataHora: new Date('2026-06-16T22:00:00-03:00'), casa: 'ARG', visitante: 'AGL', estadio: 'Kansas City',         rodada: 1, grupo: 'J' },
    { dataHora: new Date('2026-06-17T01:00:00-03:00'), casa: 'AUT', visitante: 'JOR', estadio: 'Santa Clara',         rodada: 1, grupo: 'J' },
    { dataHora: new Date('2026-06-17T14:00:00-03:00'), casa: 'POR', visitante: 'RDC', estadio: 'Houston',             rodada: 1, grupo: 'K' },
    { dataHora: new Date('2026-06-17T17:00:00-03:00'), casa: 'ING', visitante: 'CRO', estadio: 'Dallas',              rodada: 1, grupo: 'L' },
    { dataHora: new Date('2026-06-17T20:00:00-03:00'), casa: 'GAN', visitante: 'PAN', estadio: 'Toronto Field',       rodada: 1, grupo: 'L' },
    { dataHora: new Date('2026-06-17T23:00:00-03:00'), casa: 'UZB', visitante: 'COL', estadio: 'Azteca',              rodada: 1, grupo: 'K' },
    // Rodada 2
    { dataHora: new Date('2026-06-18T13:00:00-03:00'), casa: 'TCH', visitante: 'AFS', estadio: 'Atlanta',             rodada: 2, grupo: 'A' },
    { dataHora: new Date('2026-06-18T16:00:00-03:00'), casa: 'SUI', visitante: 'BOS', estadio: 'Los Angeles',         rodada: 2, grupo: 'B' },
    { dataHora: new Date('2026-06-18T19:00:00-03:00'), casa: 'CAN', visitante: 'CAT', estadio: 'Vancouver Place',     rodada: 2, grupo: 'B' },
    { dataHora: new Date('2026-06-18T22:00:00-03:00'), casa: 'MEX', visitante: 'COR', estadio: 'Akron',               rodada: 2, grupo: 'A' },
    { dataHora: new Date('2026-06-19T16:00:00-03:00'), casa: 'EUA', visitante: 'AUS', estadio: 'Seattle Field',       rodada: 2, grupo: 'D' },
    { dataHora: new Date('2026-06-19T19:00:00-03:00'), casa: 'ESC', visitante: 'MAR', estadio: 'Boston',              rodada: 2, grupo: 'C' },
    { dataHora: new Date('2026-06-19T21:30:00-03:00'), casa: 'BRA', visitante: 'HAI', estadio: 'Filadélfia',          rodada: 2, grupo: 'C' },
    { dataHora: new Date('2026-06-20T01:00:00-03:00'), casa: 'TUR', visitante: 'PAR', estadio: 'Santa Clara',         rodada: 2, grupo: 'D' },
    { dataHora: new Date('2026-06-20T14:00:00-03:00'), casa: 'HOL', visitante: 'SUE', estadio: 'Houston',             rodada: 2, grupo: 'F' },
    { dataHora: new Date('2026-06-20T17:00:00-03:00'), casa: 'ALE', visitante: 'CDM', estadio: 'Toronto Field',       rodada: 2, grupo: 'E' },
    { dataHora: new Date('2026-06-20T21:00:00-03:00'), casa: 'EQU', visitante: 'CUR', estadio: 'Kansas City',         rodada: 2, grupo: 'E' },
    { dataHora: new Date('2026-06-21T01:00:00-03:00'), casa: 'TUN', visitante: 'JAP', estadio: 'El Gigante de Acero', rodada: 2, grupo: 'F' },
    { dataHora: new Date('2026-06-21T13:00:00-03:00'), casa: 'ESP', visitante: 'ARS', estadio: 'Atlanta',             rodada: 2, grupo: 'H' },
    { dataHora: new Date('2026-06-21T16:00:00-03:00'), casa: 'BEL', visitante: 'IRA', estadio: 'Los Angeles',         rodada: 2, grupo: 'G' },
    { dataHora: new Date('2026-06-21T19:00:00-03:00'), casa: 'URU', visitante: 'CAB', estadio: 'Miami',               rodada: 2, grupo: 'H' },
    { dataHora: new Date('2026-06-21T22:00:00-03:00'), casa: 'NZE', visitante: 'EGI', estadio: 'Vancouver Place',     rodada: 2, grupo: 'G' },
    { dataHora: new Date('2026-06-22T14:00:00-03:00'), casa: 'ARG', visitante: 'AUT', estadio: 'Dallas',              rodada: 2, grupo: 'J' },
    { dataHora: new Date('2026-06-22T18:00:00-03:00'), casa: 'FRA', visitante: 'IRQ', estadio: 'Filadélfia',          rodada: 2, grupo: 'I' },
    { dataHora: new Date('2026-06-22T21:00:00-03:00'), casa: 'NOR', visitante: 'SEN', estadio: 'Nova Jersey',         rodada: 2, grupo: 'I' },
    { dataHora: new Date('2026-06-23T00:00:00-03:00'), casa: 'JOR', visitante: 'AGL', estadio: 'Santa Clara',         rodada: 2, grupo: 'J' },
    { dataHora: new Date('2026-06-23T14:00:00-03:00'), casa: 'POR', visitante: 'UZB', estadio: 'Houston',             rodada: 2, grupo: 'K' },
    { dataHora: new Date('2026-06-23T17:00:00-03:00'), casa: 'ING', visitante: 'GAN', estadio: 'Boston',              rodada: 2, grupo: 'L' },
    { dataHora: new Date('2026-06-23T20:00:00-03:00'), casa: 'PAN', visitante: 'CRO', estadio: 'Toronto Field',       rodada: 2, grupo: 'L' },
    { dataHora: new Date('2026-06-23T23:00:00-03:00'), casa: 'COL', visitante: 'RDC', estadio: 'Akron',               rodada: 2, grupo: 'K' },
    // Rodada 3
    { dataHora: new Date('2026-06-24T16:00:00-03:00'), casa: 'SUI', visitante: 'CAN', estadio: 'Vancouver Place',     rodada: 3, grupo: 'B' },
    { dataHora: new Date('2026-06-24T16:00:00-03:00'), casa: 'BOS', visitante: 'CAT', estadio: 'Seattle Field',       rodada: 3, grupo: 'B' },
    { dataHora: new Date('2026-06-24T19:00:00-03:00'), casa: 'MAR', visitante: 'HAI', estadio: 'Atlanta',             rodada: 3, grupo: 'C' },
    { dataHora: new Date('2026-06-24T19:00:00-03:00'), casa: 'ESC', visitante: 'BRA', estadio: 'Miami',               rodada: 3, grupo: 'C' },
    { dataHora: new Date('2026-06-24T22:00:00-03:00'), casa: 'AFS', visitante: 'COR', estadio: 'El Gigante de Acero', rodada: 3, grupo: 'A' },
    { dataHora: new Date('2026-06-24T22:00:00-03:00'), casa: 'TCH', visitante: 'MEX', estadio: 'Azteca',              rodada: 3, grupo: 'A' },
    { dataHora: new Date('2026-06-25T17:00:00-03:00'), casa: 'EQU', visitante: 'ALE', estadio: 'Nova Jersey',         rodada: 3, grupo: 'E' },
    { dataHora: new Date('2026-06-25T17:00:00-03:00'), casa: 'CUR', visitante: 'CDM', estadio: 'Filadélfia',          rodada: 3, grupo: 'E' },
    { dataHora: new Date('2026-06-25T20:00:00-03:00'), casa: 'TUN', visitante: 'HOL', estadio: 'Kansas City',         rodada: 3, grupo: 'F' },
    { dataHora: new Date('2026-06-25T20:00:00-03:00'), casa: 'JAP', visitante: 'SUE', estadio: 'Dallas',              rodada: 3, grupo: 'F' },
    { dataHora: new Date('2026-06-25T23:00:00-03:00'), casa: 'PAR', visitante: 'AUS', estadio: 'Santa Clara',         rodada: 3, grupo: 'D' },
    { dataHora: new Date('2026-06-25T23:00:00-03:00'), casa: 'TUR', visitante: 'EUA', estadio: 'Los Angeles',         rodada: 3, grupo: 'D' },
    { dataHora: new Date('2026-06-26T16:00:00-03:00'), casa: 'SEN', visitante: 'IRQ', estadio: 'Toronto Field',       rodada: 3, grupo: 'I' },
    { dataHora: new Date('2026-06-26T16:00:00-03:00'), casa: 'NOR', visitante: 'FRA', estadio: 'Boston',              rodada: 3, grupo: 'I' },
    { dataHora: new Date('2026-06-26T21:00:00-03:00'), casa: 'URU', visitante: 'ESP', estadio: 'Akron',               rodada: 3, grupo: 'H' },
    { dataHora: new Date('2026-06-26T21:00:00-03:00'), casa: 'CAB', visitante: 'ARS', estadio: 'Houston',             rodada: 3, grupo: 'H' },
    { dataHora: new Date('2026-06-27T00:00:00-03:00'), casa: 'EGI', visitante: 'IRA', estadio: 'Seattle Field',       rodada: 3, grupo: 'G' },
    { dataHora: new Date('2026-06-27T00:00:00-03:00'), casa: 'NZE', visitante: 'BEL', estadio: 'Vancouver Place',     rodada: 3, grupo: 'G' },
    { dataHora: new Date('2026-06-27T18:00:00-03:00'), casa: 'CRO', visitante: 'GAN', estadio: 'Filadélfia',          rodada: 3, grupo: 'L' },
    { dataHora: new Date('2026-06-27T18:00:00-03:00'), casa: 'PAN', visitante: 'ING', estadio: 'Nova Jersey',         rodada: 3, grupo: 'L' },
    { dataHora: new Date('2026-06-27T20:30:00-03:00'), casa: 'COL', visitante: 'POR', estadio: 'Miami',               rodada: 3, grupo: 'K' },
    { dataHora: new Date('2026-06-27T20:30:00-03:00'), casa: 'RDC', visitante: 'UZB', estadio: 'Atlanta',             rodada: 3, grupo: 'K' },
    { dataHora: new Date('2026-06-27T23:00:00-03:00'), casa: 'AGL', visitante: 'AUT', estadio: 'Kansas City',         rodada: 3, grupo: 'J' },
    { dataHora: new Date('2026-06-27T23:00:00-03:00'), casa: 'JOR', visitante: 'ARG', estadio: 'Dallas',              rodada: 3, grupo: 'J' },
  ];

  await prisma.jogo.createMany({
    data: jogosRaw.map(j => ({
      selecaoCasaId:      selecaoMap[j.casa],
      selecaoVisitanteId: selecaoMap[j.visitante],
      estadioId:          estadioMap[j.estadio],
      dataHora:           j.dataHora,
      rodada:             j.rodada,
      grupo:              j.grupo,
      fase:               JogoFase.GRUPOS,
      pesoPontuacao:      1,
    })),
  });

  console.log('Seed concluído: 16 estádios, 48 seleções, 72 jogos.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
