import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  nome?: string;

  @IsOptional() @IsString()
  avatarUrl?: string;
}
