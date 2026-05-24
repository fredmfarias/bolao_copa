import { Module } from '@nestjs/common';
import { BolaoController } from './bolao.controller';
import { BolaoService } from './bolao.service';
import { ApostaModule } from '../aposta/aposta.module';

@Module({ imports: [ApostaModule], controllers: [BolaoController], providers: [BolaoService] })
export class BolaoModule {}
