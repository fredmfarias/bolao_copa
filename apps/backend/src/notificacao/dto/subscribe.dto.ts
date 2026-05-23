import { IsString, IsUrl } from 'class-validator';

export class SubscribeDto {
  @IsUrl() endpoint: string;
  @IsString() p256dh: string;
  @IsString() auth: string;
}
