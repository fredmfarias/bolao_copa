import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { NotificacaoService } from './notificacao.service';

@Processor('aposta-reminder')
export class NotificacaoProcessor {
  constructor(private service: NotificacaoService) {}

  @Process('lembrar')
  async handle(job: Job<{ jogoId: string }>) {
    await this.service.processarLembrete(job.data.jogoId);
  }
}
