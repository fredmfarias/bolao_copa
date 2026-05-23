import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

const prismaMock = {
  usuario: { findUnique: jest.fn(), create: jest.fn() },
  bolaoMembro: { create: jest.fn() },
  ranking: { create: jest.fn() },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: 'MAILER', useValue: { sendMail: jest.fn() } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('registrar lança ConflictException se e-mail já existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });
    await expect(
      service.registrar({ nome: 'Test', email: 'a@a.com', senha: '12345678' }),
    ).rejects.toThrow(ConflictException);
  });

  it('registrar cria usuário e entra no bolão global', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bolaoId: '00000000-0000-0000-0000-000000000001' }),
      }),
    );
  });

  it('login lança UnauthorizedException se e-mail não existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', senha: '12345678' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
