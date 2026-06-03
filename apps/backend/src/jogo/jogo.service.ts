import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJogoDto } from './dto/create-jogo.dto';
import { UpdatePlacarDto } from './dto/update-placar.dto';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

@Injectable()
export class JogoService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('ranking-recalc') private rankingQueue: Queue,
    @InjectQueue('aposta-reminder') private reminderQueue: Queue,
  ) {}

  async criar(dto: CreateJogoDto) {
    const jogo = await this.prisma.jogo.create({
      data: { ...dto, dataHora: new Date(dto.dataHora), pesoPontuacao: dto.pesoPontuacao ?? 1 },
    });
    await this.agendarLembrete(jogo.id, new Date(dto.dataHora));
    return jogo;
  }

  async listar(fase?: string) {
    return this.prisma.jogo.findMany({
      where: fase ? { fase: fase as any } : undefined,
      include: { selecaoCasa: true, selecaoVisitante: true, estadio: true },
      orderBy: { dataHora: 'asc' },
    });
  }

  async obter(jogoId: string) {
    const jogo = await this.prisma.jogo.findUnique({
      where: { id: jogoId },
      include: { selecaoCasa: true, selecaoVisitante: true, estadio: true },
    });
    if (!jogo) throw new NotFoundException('Jogo não encontrado.');
    return jogo;
  }

  async atualizarPlacar(jogoId: string, dto: UpdatePlacarDto) {
    const jogo = await this.prisma.jogo.update({
      where: { id: jogoId },
      data: { placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante },
    });
    await this.rankingQueue.add('recalcular', { jogoId }, { attempts: 3, backoff: 5000 });
    return jogo;
  }

  async verificarLembretes(): Promise<{ jogoId: string; dataHora: Date; casa: string; visitante: string; agendado: boolean }[]> {
    const agora = new Date();
    const jogos = await this.prisma.jogo.findMany({
      where: { dataHora: { gt: agora }, placarCasa: null },
      select: {
        id: true, dataHora: true,
        selecaoCasa:      { select: { nome: true } },
        selecaoVisitante: { select: { nome: true } },
      },
      orderBy: { dataHora: 'asc' },
    });

    return Promise.all(
      jogos.map(async (j) => {
        const job = await this.reminderQueue.getJob(`reminder-${j.id}`);
        return {
          jogoId: j.id,
          dataHora: j.dataHora,
          casa: (j.selecaoCasa as any).nome,
          visitante: (j.selecaoVisitante as any).nome,
          agendado: !!job,
        };
      }),
    );
  }

  async reagendarLembretes(): Promise<{ total: number; agendados: number }> {
    const agora = new Date();
    const jogos = await this.prisma.jogo.findMany({
      where: { dataHora: { gt: agora }, placarCasa: null },
      select: { id: true, dataHora: true },
    });

    let agendados = 0;
    for (const j of jogos) {
      const delay = j.dataHora.getTime() - Date.now() - (MINUTOS_PRAZO_APOSTA + 60) * 60 * 1000;
      if (delay > 0) {
        await this.agendarLembrete(j.id, j.dataHora);
        agendados++;
      }
    }
    return { total: jogos.length, agendados };
  }

  private async agendarLembrete(jogoId: string, dataHora: Date) {
    const jobId = `reminder-${jogoId}`;
    const existing = await this.reminderQueue.getJob(jobId);
    if (existing) await existing.remove();

    // dispara (MINUTOS_PRAZO_APOSTA + 60) min antes do jogo para lembrar apostadores
    const delay = dataHora.getTime() - Date.now() - (MINUTOS_PRAZO_APOSTA + 60) * 60 * 1000;
    if (delay > 0) {
      await this.reminderQueue.add('lembrar', { jogoId }, { jobId, delay, attempts: 2 });
    }
  }
}
