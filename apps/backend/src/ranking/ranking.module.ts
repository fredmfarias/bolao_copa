import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RankingService } from './ranking.service';
import { RankingProcessor } from './ranking.processor';
import { RankingController } from './ranking.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'ranking-recalc' })],
  controllers: [RankingController],
  providers: [RankingService, RankingProcessor],
  exports: [RankingService],
})
export class RankingModule {}
