import { Module } from '@nestjs/common';
import { PublicacaoService } from './publicacao.service';
import { PublicacaoController } from './publicacao.controller';
import { RankingModule } from '../ranking/ranking.module';
import { NotificacaoModule } from '../notificacao/notificacao.module';

@Module({
  imports: [RankingModule, NotificacaoModule],
  controllers: [PublicacaoController],
  providers: [PublicacaoService],
  exports: [PublicacaoService],
})
export class PublicacaoModule {}
