import { Injectable, ConflictException, UnauthorizedException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject('MAILER') private mailer: any,
    private inscricaoWindow: InscricaoWindowService,
  ) {}

  async registrar(dto: RegisterDto) {
    await this.inscricaoWindow.assertAberta();

    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('E-mail já cadastrado.');

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const usuario = await this.prisma.usuario.create({
      data: { nome: dto.nome, email: dto.email, senhaHash, telefone: dto.telefone },
    });

    await this.prisma.bolaoMembro.create({
      data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
    });
    await this.prisma.ranking.create({
      data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
    });

    await this.enviarEmailConfirmacao(usuario.id, usuario.email);
    return { message: 'Cadastro realizado. Verifique seu e-mail.' };
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!usuario || !usuario.senhaHash) throw new UnauthorizedException('Credenciais inválidas.');

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas.');

    if (!usuario.emailVerificado) {
      throw new UnauthorizedException('Confirme seu e-mail antes de entrar.');
    }

    if (!usuario.ativo) {
      throw new UnauthorizedException('Sua conta está desativada.');
    }

    return this.gerarTokens(usuario.id, usuario.email, usuario.role);
  }

  async gerarTokens(usuarioId: string, email: string, role: string) {
    const payload = { sub: usuarioId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async confirmarEmail(token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.get('JWT_SECRET') });
      if (payload.type !== 'email-confirm') throw new Error();
      await this.prisma.usuario.update({
        where: { id: payload.sub },
        data: { emailVerificado: true },
      });
      return { message: 'E-mail confirmado.' };
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  async esqueceuSenha(email: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return { message: 'Se o e-mail existir, você receberá as instruções.' };

    const token = await this.jwt.signAsync(
      { sub: usuario.id, type: 'reset-password' },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );
    const url = `${this.config.get('APP_URL')}/auth/nova-senha?token=${token}`;
    await this.mailer.sendMail({
      to: email,
      subject: 'Recuperação de senha — Bolão Trovão',
      html: `<p>Clique para redefinir: <a href="${url}">${url}</a></p>`,
    });
    return { message: 'Se o e-mail existir, você receberá as instruções.' };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.config.get('JWT_SECRET') });
      if (payload.type !== 'reset-password') throw new Error();
      const senhaHash = await bcrypt.hash(novaSenha, 12);
      await this.prisma.usuario.update({
        where: { id: payload.sub },
        data: { senhaHash },
      });
      return { message: 'Senha redefinida.' };
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  private async enviarEmailConfirmacao(usuarioId: string, email: string) {
    const token = await this.jwt.signAsync(
      { sub: usuarioId, type: 'email-confirm' },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '24h' },
    );
    const url = `${this.config.get('APP_URL')}/auth/confirmar-email?token=${token}`;
    await this.mailer.sendMail({
      to: email,
      subject: 'Confirme seu e-mail — Bolão Trovão',
      html: `<p>Clique para confirmar: <a href="${url}">${url}</a></p>`,
    });
  }
}
