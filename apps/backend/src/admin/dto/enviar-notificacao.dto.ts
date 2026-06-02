import { IsString, IsNotEmpty, IsOptional, IsArray, IsUUID } from 'class-validator';

export class EnviarNotificacaoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  corpo: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  usuarioIds?: string[];
}
