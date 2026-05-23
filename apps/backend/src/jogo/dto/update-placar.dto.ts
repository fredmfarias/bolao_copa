import { IsInt, Min } from 'class-validator';

export class UpdatePlacarDto {
  @IsInt() @Min(0) placarCasa: number;
  @IsInt() @Min(0) placarVisitante: number;
}
