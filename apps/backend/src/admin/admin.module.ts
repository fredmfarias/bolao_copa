import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RankingModule } from '../ranking/ranking.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [RankingModule, JwtModule, MailerModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
