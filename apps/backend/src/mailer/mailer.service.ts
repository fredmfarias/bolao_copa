import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: Number(config.get('SMTP_PORT')),
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    await this.transporter.sendMail({ from: this.config.get('SMTP_FROM'), ...options });
  }
}
