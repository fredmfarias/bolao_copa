import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EstatisticaService } from './estatistica.service';

@UseGuards(JwtAuthGuard)
@Controller('boloes/:bolaoId/estatisticas')
export class EstatisticaController {
  constructor(private service: EstatisticaService) {}

  @Get()
  obter(@Param('bolaoId') bolaoId: string, @CurrentUser() user: { id: string }) {
    return this.service.obter(bolaoId, user.id);
  }
}
