import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApostaService } from './aposta.service';
import { UpsertApostaDto } from './dto/upsert-aposta.dto';

@UseGuards(JwtAuthGuard)
@Controller('apostas')
export class ApostaController {
  constructor(private service: ApostaService) {}

  @Post()
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertApostaDto) {
    return this.service.upsert(user.id, dto);
  }

  @Get('bolao/:bolaoId')
  listar(@CurrentUser() user: { id: string }, @Param('bolaoId') bolaoId: string) {
    return this.service.listarPorBolao(bolaoId, user.id);
  }
}
