import { PrismaClient, BolaoStatus, BolaoEscopo, Role } from '@prisma/client';

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

  // Estádios Copa 2026 — 16 sedes confirmadas pela FIFA
  const estadios = [
    { nome: 'MetLife Stadium',         cidade: 'East Rutherford', pais: 'EUA'    },
    { nome: 'SoFi Stadium',            cidade: 'Inglewood',       pais: 'EUA'    },
    { nome: "Levi's Stadium",          cidade: 'Santa Clara',     pais: 'EUA'    },
    { nome: 'AT&T Stadium',            cidade: 'Arlington',       pais: 'EUA'    },
    { nome: 'NRG Stadium',             cidade: 'Houston',         pais: 'EUA'    },
    { nome: 'Hard Rock Stadium',       cidade: 'Miami Gardens',   pais: 'EUA'    },
    { nome: 'Mercedes-Benz Stadium',   cidade: 'Atlanta',         pais: 'EUA'    },
    { nome: 'Lumen Field',             cidade: 'Seattle',         pais: 'EUA'    },
    { nome: 'Arrowhead Stadium',       cidade: 'Kansas City',     pais: 'EUA'    },
    { nome: 'Lincoln Financial Field', cidade: 'Philadelphia',    pais: 'EUA'    },
    { nome: 'Gillette Stadium',        cidade: 'Foxborough',      pais: 'EUA'    },
    { nome: 'Estadio Azteca',          cidade: 'Cidade do México',pais: 'México' },
    { nome: 'Estadio Akron',           cidade: 'Guadalajara',     pais: 'México' },
    { nome: 'Estadio BBVA',            cidade: 'Monterrey',       pais: 'México' },
    { nome: 'BMO Field',               cidade: 'Toronto',         pais: 'Canadá' },
    { nome: 'BC Place',                cidade: 'Vancouver',       pais: 'Canadá' },
  ];
  for (const e of estadios) {
    await prisma.estadio.upsert({
      where: { nome: e.nome },
      update: {},
      create: e,
    });
  }

  // Seleções — 48 times em 12 grupos (A–L)
  // ATENÇÃO: grupos provisórios — atualizar após sorteio oficial da FIFA
  const selecoes = [
    { nome: 'Brasil',          codigo: 'BRA', grupo: 'A', bandeiraSvg: '/flags/BRA.svg' },
    { nome: 'Alemanha',        codigo: 'GER', grupo: 'A', bandeiraSvg: '/flags/GER.svg' },
    { nome: 'Japão',           codigo: 'JPN', grupo: 'A', bandeiraSvg: '/flags/JPN.svg' },
    { nome: 'Marrocos',        codigo: 'MAR', grupo: 'A', bandeiraSvg: '/flags/MAR.svg' },
    { nome: 'Argentina',       codigo: 'ARG', grupo: 'B', bandeiraSvg: '/flags/ARG.svg' },
    { nome: 'França',          codigo: 'FRA', grupo: 'B', bandeiraSvg: '/flags/FRA.svg' },
    { nome: 'Senegal',         codigo: 'SEN', grupo: 'B', bandeiraSvg: '/flags/SEN.svg' },
    { nome: 'Equador',         codigo: 'ECU', grupo: 'B', bandeiraSvg: '/flags/ECU.svg' },
    { nome: 'Espanha',         codigo: 'ESP', grupo: 'C', bandeiraSvg: '/flags/ESP.svg' },
    { nome: 'Portugal',        codigo: 'POR', grupo: 'C', bandeiraSvg: '/flags/POR.svg' },
    { nome: 'México',          codigo: 'MEX', grupo: 'C', bandeiraSvg: '/flags/MEX.svg' },
    { nome: 'Camarões',        codigo: 'CMR', grupo: 'C', bandeiraSvg: '/flags/CMR.svg' },
    { nome: 'Inglaterra',      codigo: 'ENG', grupo: 'D', bandeiraSvg: '/flags/ENG.svg' },
    { nome: 'Holanda',         codigo: 'NED', grupo: 'D', bandeiraSvg: '/flags/NED.svg' },
    { nome: 'Uruguai',         codigo: 'URU', grupo: 'D', bandeiraSvg: '/flags/URU.svg' },
    { nome: 'Tunísia',         codigo: 'TUN', grupo: 'D', bandeiraSvg: '/flags/TUN.svg' },
    { nome: 'Bélgica',         codigo: 'BEL', grupo: 'E', bandeiraSvg: '/flags/BEL.svg' },
    { nome: 'Itália',          codigo: 'ITA', grupo: 'E', bandeiraSvg: '/flags/ITA.svg' },
    { nome: 'Colômbia',        codigo: 'COL', grupo: 'E', bandeiraSvg: '/flags/COL.svg' },
    { nome: 'Austrália',       codigo: 'AUS', grupo: 'E', bandeiraSvg: '/flags/AUS.svg' },
    { nome: 'Estados Unidos',  codigo: 'USA', grupo: 'F', bandeiraSvg: '/flags/USA.svg' },
    { nome: 'Croácia',         codigo: 'CRO', grupo: 'F', bandeiraSvg: '/flags/CRO.svg' },
    { nome: 'Suíça',           codigo: 'SUI', grupo: 'F', bandeiraSvg: '/flags/SUI.svg' },
    { nome: 'Gana',            codigo: 'GHA', grupo: 'F', bandeiraSvg: '/flags/GHA.svg' },
    { nome: 'Canadá',          codigo: 'CAN', grupo: 'G', bandeiraSvg: '/flags/CAN.svg' },
    { nome: 'Sérvia',          codigo: 'SRB', grupo: 'G', bandeiraSvg: '/flags/SRB.svg' },
    { nome: 'Dinamarca',       codigo: 'DEN', grupo: 'G', bandeiraSvg: '/flags/DEN.svg' },
    { nome: 'Irã',             codigo: 'IRN', grupo: 'G', bandeiraSvg: '/flags/IRN.svg' },
    { nome: 'Coreia do Sul',   codigo: 'KOR', grupo: 'H', bandeiraSvg: '/flags/KOR.svg' },
    { nome: 'Polônia',         codigo: 'POL', grupo: 'H', bandeiraSvg: '/flags/POL.svg' },
    { nome: 'Turquia',         codigo: 'TUR', grupo: 'H', bandeiraSvg: '/flags/TUR.svg' },
    { nome: 'Costa Rica',      codigo: 'CRC', grupo: 'H', bandeiraSvg: '/flags/CRC.svg' },
    { nome: 'Países Baixos',   codigo: 'NLD', grupo: 'I', bandeiraSvg: '/flags/NLD.svg' },
    { nome: 'Áustria',         codigo: 'AUT', grupo: 'I', bandeiraSvg: '/flags/AUT.svg' },
    { nome: 'Chile',           codigo: 'CHI', grupo: 'I', bandeiraSvg: '/flags/CHI.svg' },
    { nome: 'Nigéria',         codigo: 'NGA', grupo: 'I', bandeiraSvg: '/flags/NGA.svg' },
    { nome: 'Paraguai',        codigo: 'PAR', grupo: 'J', bandeiraSvg: '/flags/PAR.svg' },
    { nome: 'Venezuela',       codigo: 'VEN', grupo: 'J', bandeiraSvg: '/flags/VEN.svg' },
    { nome: 'Arábia Saudita',  codigo: 'KSA', grupo: 'J', bandeiraSvg: '/flags/KSA.svg' },
    { nome: 'Gales',           codigo: 'WAL', grupo: 'J', bandeiraSvg: '/flags/WAL.svg' },
    { nome: 'Peru',            codigo: 'PER', grupo: 'K', bandeiraSvg: '/flags/PER.svg' },
    { nome: 'Escócia',         codigo: 'SCO', grupo: 'K', bandeiraSvg: '/flags/SCO.svg' },
    { nome: 'Egito',           codigo: 'EGY', grupo: 'K', bandeiraSvg: '/flags/EGY.svg' },
    { nome: 'Argélia',         codigo: 'ALG', grupo: 'K', bandeiraSvg: '/flags/ALG.svg' },
    { nome: 'Bolívia',         codigo: 'BOL', grupo: 'L', bandeiraSvg: '/flags/BOL.svg' },
    { nome: 'Noruega',         codigo: 'NOR', grupo: 'L', bandeiraSvg: '/flags/NOR.svg' },
    { nome: 'Costa do Marfim', codigo: 'CIV', grupo: 'L', bandeiraSvg: '/flags/CIV.svg' },
    { nome: 'Romênia',         codigo: 'ROU', grupo: 'L', bandeiraSvg: '/flags/ROU.svg' },
  ];
  for (const s of selecoes) {
    await prisma.selecao.upsert({
      where: { codigo: s.codigo },
      update: {},
      create: s,
    });
  }

  console.log('Seed concluído.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
