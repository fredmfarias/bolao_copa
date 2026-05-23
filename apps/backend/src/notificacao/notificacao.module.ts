import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificacaoController } from './notificacao.controller';
import { NotificacaoService } from './notificacao.service';
import { NotificacaoProcessor } from './notificacao.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'aposta-reminder' })],
  controllers: [NotificacaoController],
  providers: [NotificacaoService, NotificacaoProcessor],
})
export class NotificacaoModule {}
