import { Global, Module } from '@nestjs/common';
import { InscricaoWindowService } from './inscricao-window.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [InscricaoWindowService],
  exports: [InscricaoWindowService],
})
export class InscricaoWindowModule {}
