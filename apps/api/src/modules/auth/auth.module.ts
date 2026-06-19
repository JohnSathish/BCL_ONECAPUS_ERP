import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TenantsModule } from '../tenants/tenants.module';
import { SecurityCommonModule } from '../../common/security/security-common.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginAttemptService } from './login-attempt.service';
import { MfaService } from './mfa/mfa.service';
import { MfaController } from './mfa/mfa.controller';
import { StepUpService } from './step-up.service';
import { StepUpController } from './step-up.controller';

@Module({
  imports: [
    TenantsModule,
    SecurityCommonModule,
    CryptoModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, MfaController, StepUpController],
  providers: [
    AuthService,
    ChallengeService,
    LoginAttemptService,
    JwtStrategy,
    MfaService,
    StepUpService,
  ],
  exports: [AuthService, MfaService, StepUpService],
})
export class AuthModule {}
