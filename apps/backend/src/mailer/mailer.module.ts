import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Module({
  providers: [{ provide: 'MAILER', useClass: MailerService }],
  exports: ['MAILER'],
})
export class MailerModule {}
