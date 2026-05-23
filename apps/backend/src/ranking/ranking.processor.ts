import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { RankingService } from './ranking.service';

@Processor('ranking-recalc')
export class RankingProcessor {
  constructor(private rankingService: RankingService) {}

  @Process('recalcular')
  async handle(job: Job<{ jogoId: string }>) {
    await this.rankingService.recalcularParaJogo(job.data.jogoId);
  }
}
