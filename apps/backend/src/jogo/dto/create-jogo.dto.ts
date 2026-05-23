import { IsString, IsEnum, IsInt, IsDateString, IsOptional, Min } from 'class-validator';
import { JogoFase } from '@bolao/shared';

export class CreateJogoDto {
  @IsString() selecaoCasaId: string;
  @IsString() selecaoVisitanteId: string;
  @IsString() estadioId: string;
  @IsDateString() dataHora: string;
  @IsInt() @Min(1) rodada: number;
  @IsOptional() @IsString() grupo?: string;
  @IsEnum(JogoFase) fase: JogoFase;
  @IsOptional() @IsInt() @Min(1) pesoPontuacao?: number;
}
