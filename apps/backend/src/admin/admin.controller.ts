import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { Role } from '@bolao/shared';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private service: AdminService) {}

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
}
