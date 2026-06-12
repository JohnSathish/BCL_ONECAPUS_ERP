import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginAttemptService } from './login-attempt.service';

@Module({
  imports: [
    TenantsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ChallengeService, LoginAttemptService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
