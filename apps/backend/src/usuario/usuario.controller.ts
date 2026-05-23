import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioService } from './usuario.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuarioController {
  constructor(private service: UsuarioService) {}

  @Get('me')
  perfil(@CurrentUser() user: { id: string }) {
    return this.service.perfil(user.id);
  }

  @Patch('me')
  atualizar(@CurrentUser() user: { id: string }, @Body() dto: UpdateUsuarioDto) {
    return this.service.atualizar(user.id, dto);
  }
}
