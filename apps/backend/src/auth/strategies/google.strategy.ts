import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      // Falls back to placeholder so the app starts without Google credentials;
      // the /auth/google route simply won't work until real values are provided.
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'GOOGLE_NOT_CONFIGURED',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'GOOGLE_NOT_CONFIGURED',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: any, done: VerifyCallback) {
    const { id, displayName, emails, photos } = profile;
    done(null, {
      googleId: id,
      nome: displayName,
      email: emails[0].value,
      avatarUrl: photos?.[0]?.value ?? null,
    });
  }
}
