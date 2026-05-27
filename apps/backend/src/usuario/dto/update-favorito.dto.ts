import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateFavoritoDto {
  @ValidateIf(o => o.bolaoId !== null)
  @IsUUID()
  bolaoId: string | null;
}
