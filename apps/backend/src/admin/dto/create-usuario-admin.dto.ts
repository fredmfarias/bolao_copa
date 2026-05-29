import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateUsuarioAdminDto {
  @IsString() @MinLength(2) @MaxLength(60)
  nome: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8)
  senhaTemp: string;

  @IsOptional() @IsUUID()
  bolaoId?: string;
}
