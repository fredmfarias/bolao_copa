import { Test } from '@nestjs/testing';
import { UsuarioService } from './usuario.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

const prismaMock = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bolaoMembro: {
    findUnique: jest.fn(),
  },
};

describe('UsuarioService', () => {
  let service: UsuarioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsuarioService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(UsuarioService);
    jest.clearAllMocks();
  });

  describe('atualizarFavorito', () => {
    it('lança ForbiddenException se usuário não é membro do bolão', async () => {
      prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
      await expect(
        service.atualizarFavorito('user-1', 'bolao-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('persiste bolaoFavoritoId quando usuário é membro', async () => {
      prismaMock.bolaoMembro.findUnique.mockResolvedValue({ id: 'mb-1' });
      prismaMock.usuario.update.mockResolvedValue({
        id: 'user-1',
        bolaoFavoritoId: 'bolao-1',
      });
      await service.atualizarFavorito('user-1', 'bolao-1');
      expect(prismaMock.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { bolaoFavoritoId: 'bolao-1' },
          where: { id: 'user-1' },
        }),
      );
    });

    it('persiste bolaoFavoritoId como null sem checar membership', async () => {
      prismaMock.usuario.update.mockResolvedValue({
        id: 'user-1',
        bolaoFavoritoId: null,
      });
      await service.atualizarFavorito('user-1', null);
      expect(prismaMock.bolaoMembro.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bolaoFavoritoId: null } }),
      );
    });
  });
});
