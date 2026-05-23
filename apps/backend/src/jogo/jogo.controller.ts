import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JogoService } from './jogo.service';
import { CreateJogoDto } from './dto/create-jogo.dto';
import { UpdatePlacarDto } from './dto/update-placar.dto';
import { Role } from '@bolao/shared';

@Controller('jogos')
export class JogoController {
  constructor(private service: JogoService) {}

  @Get()
  listar(@Query('fase') fase?: string) {
    return this.service.listar(fase);
  }

  @Get(':jogoId')
  obter(@Param('jogoId') jogoId: string) {
    return this.service.obter(jogoId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  criar(@Body() dto: CreateJogoDto) {
    return this.service.criar(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':jogoId/placar')
  atualizarPlacar(@Param('jogoId') jogoId: string, @Body() dto: UpdatePlacarDto) {
    return this.service.atualizarPlacar(jogoId, dto);
  }
}
