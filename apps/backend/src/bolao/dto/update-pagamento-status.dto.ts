import { IsEnum } from 'class-validator';
import { StatusPagamento } from '@bolao/shared';

export class UpdatePagamentoStatusDto {
  @IsEnum(StatusPagamento)
  status: StatusPagamento;
}
