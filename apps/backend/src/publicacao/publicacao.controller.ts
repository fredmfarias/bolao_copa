import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PublicacaoService } from './publicacao.service';
import { Role } from '@bolao/shared';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/publicacoes')
export class PublicacaoController {
  constructor(private service: PublicacaoService) {}

  @Post()
  publicar(@CurrentUser() user: { id: string }) {
    return this.service.publicar(user.id);
  }
}
