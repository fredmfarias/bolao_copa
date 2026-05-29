import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BolaoModeradorGuard } from '../common/guards/bolao-moderador.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BolaoService } from './bolao.service';
import { ApostaService } from '../aposta/aposta.service';
import { CreateBolaoDto } from './dto/create-bolao.dto';
import { UpdateBolaoStatusDto } from './dto/update-bolao-status.dto';
import { Role } from '@bolao/shared';

@Controller('convites')
export class ConvitePublicoController {
  constructor(private service: BolaoService) {}

  @Get(':token')
  lookup(@Param('token') token: string) {
    return this.service.lookupConvite(token);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('boloes')
export class BolaoController {
  constructor(private service: BolaoService, private apostaService: ApostaService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  criar(@CurrentUser() user: { id: string }, @Body() dto: CreateBolaoDto) {
    return this.service.criar(user.id, dto);
  }

  @Get('meus')
  listarMeus(@CurrentUser() user: { id: string }) {
    return this.service.listarMeus(user.id);
  }

  @Get('buscar')
  buscar(@Query('nome') nome: string) {
    return this.service.buscarPorNome(nome);
  }

  @Get(':bolaoId')
  obter(@Param('bolaoId') bolaoId: string) {
    return this.service.obter(bolaoId);
  }

  @UseGuards(BolaoModeradorGuard)
  @Post(':bolaoId/convite')
  gerarConvite(
    @CurrentUser() user: { id: string },
    @Param('bolaoId') bolaoId: string,
    @Body('expiraEm') expiraEm?: string,
  ) {
    return this.service.gerarConvite(bolaoId, user.id, expiraEm ? new Date(expiraEm) : undefined);
  }

  @Post('entrar/:token')
  entrarViaConvite(@CurrentUser() user: { id: string; role: string }, @Param('token') token: string) {
    return this.service.entrarViaConvite(user, token);
  }

  @Post(':bolaoId/solicitar')
  solicitar(@CurrentUser() user: { id: string }, @Param('bolaoId') bolaoId: string) {
    return this.service.solicitarEntrada(bolaoId, user.id);
  }

  @UseGuards(BolaoModeradorGuard)
  @Post(':bolaoId/aprovar/:usuarioId')
  aprovar(
    @CurrentUser() user: { id: string; role: string },
    @Param('bolaoId') bolaoId: string,
    @Param('usuarioId') usuarioId: string,
  ) {
    return this.service.aprovarMembro(user, bolaoId, usuarioId);
  }

  @UseGuards(BolaoModeradorGuard)
  @Post(':bolaoId/remover/:usuarioId')
  remover(@Param('bolaoId') bolaoId: string, @Param('usuarioId') usuarioId: string) {
    return this.service.removerMembro(bolaoId, usuarioId);
  }

  @UseGuards(BolaoModeradorGuard)
  @Post(':bolaoId/eleger/:usuarioId')
  eleger(@Param('bolaoId') bolaoId: string, @Param('usuarioId') usuarioId: string) {
    return this.service.elegerModerador(bolaoId, usuarioId);
  }

  @Get(':bolaoId/apostas')
  listarPalpites(@Param('bolaoId') bolaoId: string, @Query('jogoId') jogoId: string) {
    return this.apostaService.listarPalpitesPorJogo(bolaoId, jogoId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':bolaoId/status')
  atualizarStatus(@Param('bolaoId') bolaoId: string, @Body() dto: UpdateBolaoStatusDto) {
    return this.service.atualizarStatus(bolaoId, dto);
  }
}
