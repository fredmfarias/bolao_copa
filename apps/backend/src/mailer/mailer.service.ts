import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isDev: boolean;

  constructor(private config: ConfigService) {
    this.isDev = config.get('NODE_ENV') !== 'production';
    if (!this.isDev) {
      this.transporter = nodemailer.createTransport({
        host: config.get('SMTP_HOST'),
        port: Number(config.get('SMTP_PORT')),
        auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') },
      });
    }
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    if (this.isDev) {
      const account = await nodemailer.createTestAccount();
      const transport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: account.user, pass: account.pass },
      });
      const info = await transport.sendMail({ from: 'dev@bolao.local', ...options });
      this.logger.log(`[DEV] E-mail para ${options.to}: ${nodemailer.getTestMessageUrl(info)}`);
      return;
    }
    await this.transporter!.sendMail({ from: this.config.get('SMTP_FROM'), ...options });
  }
}
