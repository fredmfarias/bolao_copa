import { Module } from '@nestjs/common';
import { PublicacaoService } from './publicacao.service';
import { PublicacaoController } from './publicacao.controller';
import { RankingModule } from '../ranking/ranking.module';

@Module({
  imports: [RankingModule],
  controllers: [PublicacaoController],
  providers: [PublicacaoService],
})
export class PublicacaoModule {}
