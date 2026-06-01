import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  nome?: string;

  @IsOptional() @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
  telefone?: string;
}
