import { IsEmail, IsString, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(60)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
  telefone: string;

  @IsString() @MinLength(8)
  senha: string;

  @IsNotEmpty()
  @IsString()
  conviteToken: string;
}
