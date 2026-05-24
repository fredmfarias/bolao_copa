import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
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

  @Get('ranking/:bolaoId/draft')
  getRankingDraft(@Param('bolaoId') bolaoId: string) {
    return this.service.getRankingDraft(bolaoId);
  }

  @Post('ranking/:bolaoId/publicar')
  publicarRanking(@Param('bolaoId') bolaoId: string) {
    return this.service.publicarRanking(bolaoId);
  }

  @Get('usuarios')
  listarUsuarios() {
    return this.service.listarUsuarios();
  }

  @Patch('usuarios/:id')
  atualizarUsuario(@Param('id') id: string, @Body() dto: { role?: 'ADMIN' | 'USER' }) {
    return this.service.atualizarUsuario(id, dto);
  }
}
