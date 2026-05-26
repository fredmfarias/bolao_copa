import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RankingService } from './ranking.service';

@UseGuards(JwtAuthGuard)
@Controller('boloes/:bolaoId/ranking')
export class RankingController {
  constructor(private service: RankingService) {}

  @Get()
  obter(@Param('bolaoId') bolaoId: string, @Query('publicacao') publicacao?: string) {
    return this.service.obterRanking(bolaoId, publicacao ? Number(publicacao) : undefined);
  }

  @Get('publicacoes')
  publicacoes(@Param('bolaoId') bolaoId: string) {
    return this.service.listarPublicacoes(bolaoId);
  }

  @Get('evolucao')
  evolucao(
    @Param('bolaoId') bolaoId: string,
    @CurrentUser() user: { id: string },
    @Query('usuarioId') usuarioId?: string,
  ) {
    return this.service.evolucao(bolaoId, usuarioId ?? user.id);
  }
}
