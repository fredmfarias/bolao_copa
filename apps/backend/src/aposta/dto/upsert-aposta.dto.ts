import { IsString, IsInt, Min } from 'class-validator';

export class UpsertApostaDto {
  @IsString() jogoId: string;
  @IsInt() @Min(0) placarCasa: number;
  @IsInt() @Min(0) placarVisitante: number;
}
