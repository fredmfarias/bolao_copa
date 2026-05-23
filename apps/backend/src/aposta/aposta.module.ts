import { Module } from '@nestjs/common';
import { ApostaController } from './aposta.controller';
import { ApostaService } from './aposta.service';

@Module({ controllers: [ApostaController], providers: [ApostaService] })
export class ApostaModule {}
