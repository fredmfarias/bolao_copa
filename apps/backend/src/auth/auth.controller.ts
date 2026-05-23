import { Controller, Post, Get, Body, Query, Res, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

const REFRESH_COOKIE = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('registrar')
  registrar(@Body() dto: RegisterDto) {
    return this.auth.registrar(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE);
    return { accessToken: tokens.accessToken };
  }

  @Get('confirmar-email')
  confirmarEmail(@Query('token') token: string) {
    return this.auth.confirmarEmail(token);
  }

  @Post('esqueceu-senha')
  esqueceuSenha(@Body('email') email: string) {
    return this.auth.esqueceuSenha(email);
  }

  @Post('nova-senha')
  novaSenha(@Body('token') token: string, @Body('senha') senha: string) {
    return this.auth.redefinirSenha(token, senha);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as { sub: string; email: string; role: string };
    const tokens = await this.auth.gerarTokens(user.sub, user.email, user.role);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logout realizado.' };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const profile = req.user as {
      googleId: string; nome: string; email: string; avatarUrl: string | null;
    };

    let usuario = await this.prisma.usuario.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });

    if (!usuario) {
      usuario = await this.prisma.usuario.create({
        data: {
          nome: profile.nome, email: profile.email,
          googleId: profile.googleId, avatarUrl: profile.avatarUrl,
          emailVerificado: true,
        },
      });
      await this.prisma.bolaoMembro.create({
        data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
      });
      await this.prisma.ranking.create({
        data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
      });
    } else if (!usuario.googleId) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl, emailVerificado: true },
      });
    }

    const tokens = await this.auth.gerarTokens(usuario.id, usuario.email, usuario.role);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE);
    res.redirect(`${process.env.APP_URL}/auth/callback?token=${tokens.accessToken}`);
  }
}
