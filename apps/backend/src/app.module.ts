import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuarioModule } from './usuario/usuario.module';
import { BolaoModule } from './bolao/bolao.module';
import { JogoModule } from './jogo/jogo.module';
import { ApostaModule } from './aposta/aposta.module';
import { RankingModule } from './ranking/ranking.module';
import { NotificacaoModule } from './notificacao/notificacao.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
      }),
    }),
    PrismaModule,
    AuthModule,
    UsuarioModule,
    BolaoModule,
    JogoModule,
    ApostaModule,
    RankingModule,
    NotificacaoModule,
    AdminModule,
  ],
})
export class AppModule {}
