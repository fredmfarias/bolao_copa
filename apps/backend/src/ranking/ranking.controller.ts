import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankingService } from './ranking.service';

@UseGuards(JwtAuthGuard)
@Controller('boloes/:bolaoId/ranking')
export class RankingController {
  constructor(private service: RankingService) {}

  @Get()
  obter(@Param('bolaoId') bolaoId: string) {
    return this.service.obterRanking(bolaoId);
  }
}
