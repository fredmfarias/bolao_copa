import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { Role } from '@bolao/shared';
import { CreateUsuarioAdminDto } from './dto/create-usuario-admin.dto';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private service: AdminService,
    private inscricaoWindow: InscricaoWindowService,
  ) {}

  @Get('boloes')
  listarBoloes() {
    return this.service.listarBoloes();
  }

  @Get('ranking/:bolaoId/draft')
  getRankingDraft(@Param('bolaoId') bolaoId: string) {
    return this.service.getRankingDraft(bolaoId);
  }

  @Get('publicacoes/pendente')
  listarPublicacaoPendente() {
    return this.service.listarPublicacaoPendente();
  }

  @Get('usuarios')
  listarUsuarios() {
    return this.service.listarUsuarios();
  }

  @Get('usuarios/buscar')
  buscarUsuarios(@Query('q') q: string) {
    return this.service.buscarUsuarios(q ?? '');
  }

  @Patch('usuarios/:id')
  atualizarUsuario(
    @Param('id') id: string,
    @Body() dto: { role?: 'ADMIN' | 'USER'; ativo?: boolean },
  ) {
    return this.service.atualizarUsuario(id, dto);
  }

  @Post('usuarios/:id/reset-senha')
  resetarSenha(@Param('id') id: string) {
    return this.service.resetarSenha(id);
  }

  @Post('usuarios')
  criarUsuario(@Body() dto: CreateUsuarioAdminDto) {
    return this.service.criarUsuario(dto);
  }

  @Post('boloes/:bolaoId/membros')
  adicionarUsuarioBolao(
    @Param('bolaoId') bolaoId: string,
    @Body('usuarioId') usuarioId: string,
  ) {
    return this.service.adicionarUsuarioBolao(bolaoId, usuarioId);
  }

  @Post('inscricoes/cache/clear')
  clearInscricoesCache() {
    this.inscricaoWindow.clearCache();
    return { message: 'Cache invalidado.' };
  }
}
