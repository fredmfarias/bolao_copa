import { Module } from '@nestjs/common';
import { InscricaoWindowService } from './inscricao-window.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [InscricaoWindowService],
  exports: [InscricaoWindowService],
})
export class InscricaoWindowModule {}
