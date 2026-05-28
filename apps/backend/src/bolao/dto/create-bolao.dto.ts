import { IsString, IsInt, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateBolaoDto {
  @IsString()
  nome: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsInt() @Min(10)
  maxParticipantes: number;

  @IsUUID()
  moderadorId: string;
}
