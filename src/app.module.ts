import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtSigner, PasswordHasher } from '@nestjs/authentication';
import { AppController } from './app.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { UsersRepository } from './users/users.repository.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import {
  expiryMilliseconds,
  validateEnvironment,
} from './config/environment.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
  ],
  controllers: [AppController, AuthController],
  providers: [
    UsersRepository,
    AuthService,
    { provide: PasswordHasher, useFactory: () => new PasswordHasher() },
    {
      provide: JwtSigner,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new JwtSigner({
          key: config.getOrThrow<string>('JWT_SECRET'),
          alg: 'HS256',
          ttl: expiryMilliseconds(config.getOrThrow<string>('JWT_EXPIRES_IN')),
        }),
    },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
