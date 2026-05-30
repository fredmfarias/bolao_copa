import { Module } from '@nestjs/common';
import { BolaoController, ConvitePublicoController } from './bolao.controller';
import { BolaoService } from './bolao.service';
import { ApostaModule } from '../aposta/aposta.module';

@Module({
  imports: [ApostaModule],
  controllers: [BolaoController, ConvitePublicoController],
  providers: [BolaoService],
  exports: [BolaoService],
})
export class BolaoModule {}
