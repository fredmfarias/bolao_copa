import { Controller, Post, Delete, Get, Body, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificacaoService } from './notificacao.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller('notificacoes')
export class NotificacaoController {
  constructor(private service: NotificacaoService, private config: ConfigService) {}

  @Get('vapid-public-key')
  vapidKey() {
    return { key: this.config.get('VAPID_PUBLIC_KEY') };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@CurrentUser() user: { id: string }, @Body() dto: SubscribeDto) {
    return this.service.subscribe(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscribe')
  unsubscribe(@Body('endpoint') endpoint: string) {
    return this.service.unsubscribe(endpoint);
  }
}
