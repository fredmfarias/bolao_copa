import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RankingService } from './ranking.service';
import { RankingProcessor } from './ranking.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'ranking-recalc' })],
  providers: [RankingService, RankingProcessor],
  exports: [RankingService],
})
export class RankingModule {}
