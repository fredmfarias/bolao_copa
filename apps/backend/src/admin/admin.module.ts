import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RankingModule } from '../ranking/ranking.module';
import { MailerModule } from '../mailer/mailer.module';
import { PublicacaoModule } from '../publicacao/publicacao.module';
import { BolaoModule } from '../bolao/bolao.module';

@Module({
  imports: [RankingModule, JwtModule, MailerModule, PublicacaoModule, BolaoModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
