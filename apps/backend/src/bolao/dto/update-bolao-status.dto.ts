import { IsEnum } from 'class-validator';
import { BolaoStatus } from '@bolao/shared';

export class UpdateBolaoStatusDto {
  @IsEnum(BolaoStatus)
  status: BolaoStatus;
}
