import { Module } from '@nestjs/common';
import { ApostaController } from './aposta.controller';
import { ApostaService } from './aposta.service';

@Module({ controllers: [ApostaController], providers: [ApostaService], exports: [ApostaService] })
export class ApostaModule {}
