import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JogoController } from './jogo.controller';
import { JogoService } from './jogo.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ranking-recalc' }),
    BullModule.registerQueue({ name: 'aposta-reminder' }),
  ],
  controllers: [JogoController],
  providers: [JogoService],
  exports: [JogoService],
})
export class JogoModule {}
