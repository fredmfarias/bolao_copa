import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';

const authMock = { gerarTokens: jest.fn() };
const prismaMock = {
  usuario: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  bolaoMembro: { create: jest.fn() },
  ranking: { create: jest.fn() },
};
const inscricaoMock = { getStatus: jest.fn() };

function mockRes() {
  return { cookie: jest.fn(), redirect: jest.fn() } as any;
}

describe('AuthController.googleCallback', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: InscricaoWindowService, useValue: inscricaoMock },
      ],
    }).compile();
    controller = module.get(AuthController);
    jest.clearAllMocks();
    process.env.APP_URL = 'http://app.test';
    authMock.gerarTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
  });

  it('redireciona usuário inativo para /login?erro=conta-desativada e não gera tokens', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1', email: 'x@y.com', googleId: 'g1', ativo: false, role: 'USER',
    });
    const req = { user: { googleId: 'g1', nome: 'X', email: 'x@y.com', avatarUrl: null } } as any;
    const res = mockRes();

    await controller.googleCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('http://app.test/login?erro=conta-desativada');
    expect(authMock.gerarTokens).not.toHaveBeenCalled();
  });

  it('gera tokens para usuário ativo existente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1', email: 'x@y.com', googleId: 'g1', ativo: true, role: 'USER',
    });
    const req = { user: { googleId: 'g1', nome: 'X', email: 'x@y.com', avatarUrl: null } } as any;
    const res = mockRes();

    await controller.googleCallback(req, res);

    expect(authMock.gerarTokens).toHaveBeenCalledWith('u1', 'x@y.com', 'USER');
    expect(res.redirect).toHaveBeenCalledWith('http://app.test/auth/callback?token=a');
  });
});
