import { IsString, IsEnum, IsInt, Min, IsOptional, IsUUID } from 'class-validator';
import { BolaoEscopo } from '@bolao/shared';

export class CreateBolaoDto {
  @IsString()
  nome: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsEnum(BolaoEscopo)
  escopo: BolaoEscopo;

  @IsInt() @Min(10)
  maxParticipantes: number;

  @IsUUID()
  moderadorId: string;
}
