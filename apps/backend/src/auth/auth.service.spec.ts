import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { BolaoService } from '../bolao/bolao.service';

const prismaMock = {
  usuario: { findUnique: jest.fn(), create: jest.fn() },
  bolaoMembro: { create: jest.fn() },
  ranking: { create: jest.fn() },
};

const mailerMock = { sendMail: jest.fn() };
const inscricaoMock = { assertAberta: jest.fn() };
const bolaoMock = { entrarViaConvite: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: 'MAILER', useValue: mailerMock },
        { provide: InscricaoWindowService, useValue: inscricaoMock },
        { provide: BolaoService, useValue: bolaoMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    inscricaoMock.assertAberta.mockResolvedValue(undefined);
  });

  it('registrar lança ConflictException se e-mail já existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });
    await expect(
      service.registrar({ nome: 'Test', email: 'a@a.com', senha: '12345678', telefone: '(11) 91234-5678' }),
    ).rejects.toThrow(ConflictException);
  });

  it('registrar cria usuário e entra no bolão global', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bolaoId: '00000000-0000-0000-0000-000000000001' }),
      }),
    );
  });

  it('registrar lança ForbiddenException quando janela está fechada', async () => {
    inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
    await expect(
      service.registrar({ nome: 'Test', email: 'c@c.com', senha: '12345678', telefone: '(11) 91234-5678' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it('registrar inclui telefone na criação do usuário', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678' });
    expect(prismaMock.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telefone: '(11) 91234-5678' }),
      }),
    );
  });

  it('login lança UnauthorizedException se e-mail não existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', senha: '12345678' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('barra usuário inativo no login', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@a.com', senhaHash: 'hash', emailVerificado: true,
      ativo: false, role: 'USER',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    await expect(service.login({ email: 'a@a.com', senha: 'x' }))
      .rejects.toThrow('Sua conta está desativada.');
  });

  it('envia e-mail de confirmação com URL /auth/confirmar-email', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678' });
    const html: string = mailerMock.sendMail.mock.calls[0][0].html;
    expect(html).toContain('/auth/confirmar-email?token=');
  });

  it('registrar chama entrarViaConvite quando conviteToken fornecido', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test', role: 'USER' });
    bolaoMock.entrarViaConvite.mockResolvedValue({});
    await service.registrar({
      nome: 'Test', email: 'b@b.com', senha: '12345678',
      telefone: '(11) 91234-5678', conviteToken: 'token-abc',
    });
    expect(bolaoMock.entrarViaConvite).toHaveBeenCalledWith(
      { id: 'new-id', role: 'USER' },
      'token-abc',
    );
  });

  it('registrar não chama entrarViaConvite quando conviteToken ausente', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test', role: 'USER' });
    await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678' });
    expect(bolaoMock.entrarViaConvite).not.toHaveBeenCalled();
  });

  it('registrar propaga exceção do convite inválido', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test', role: 'USER' });
    bolaoMock.entrarViaConvite.mockRejectedValueOnce(new BadRequestException('Convite inválido.'));
    await expect(
      service.registrar({
        nome: 'Test', email: 'b@b.com', senha: '12345678',
        telefone: '(11) 91234-5678', conviteToken: 'token-ruim',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
