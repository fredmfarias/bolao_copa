import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HORAS_CORTE_INSCRICAO, Role } from '@bolao/shared';

export interface InscricaoStatus {
  abertas: boolean;
  dataPrimeiroJogo: Date | null;
  dataCorte: Date | null;
}

const TTL_MS = 60_000;

@Injectable()
export class InscricaoWindowService {
  private cache: { value: InscricaoStatus; expiresAt: number } | null = null;

  constructor(private prisma: PrismaService) {}

  async getStatus(): Promise<InscricaoStatus> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;

    const primeiro = await this.prisma.jogo.findFirst({
      orderBy: { dataHora: 'asc' },
      select: { dataHora: true },
    });

    let value: InscricaoStatus;
    if (!primeiro) {
      value = { abertas: true, dataPrimeiroJogo: null, dataCorte: null };
    } else {
      const dataCorte = new Date(
        primeiro.dataHora.getTime() - HORAS_CORTE_INSCRICAO * 60 * 60 * 1000,
      );
      value = {
        abertas: Date.now() < dataCorte.getTime(),
        dataPrimeiroJogo: primeiro.dataHora,
        dataCorte,
      };
    }

    this.cache = { value, expiresAt: Date.now() + TTL_MS };
    return value;
  }

  async assertAberta(user?: { role?: string }): Promise<void> {
    if (user?.role === Role.ADMIN) return;
    const status = await this.getStatus();
    if (!status.abertas) {
      throw new ForbiddenException('Inscrições encerradas.');
    }
  }
}
