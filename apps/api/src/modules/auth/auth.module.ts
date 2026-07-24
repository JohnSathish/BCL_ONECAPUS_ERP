import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TenantsModule } from '../tenants/tenants.module';
import { SecurityCommonModule } from '../../common/security/security-common.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { DeviceSecurityModule } from '../administration/device-security.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginAttemptService } from './login-attempt.service';
import { MfaService } from './mfa/mfa.service';
import { MfaController } from './mfa/mfa.controller';
import { StepUpService } from './step-up.service';
import { StepUpController } from './step-up.controller';
import { AuthQrService } from './login-methods/auth-qr.service';
import { AuthRfidService } from './login-methods/auth-rfid.service';
import { LoginMethodsController } from './login-methods/login-methods.controller';

@Module({
  imports: [
    TenantsModule,
    SecurityCommonModule,
    CryptoModule,
    DeviceSecurityModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [
    AuthController,
    MfaController,
    StepUpController,
    LoginMethodsController,
  ],
  providers: [
    AuthService,
    ChallengeService,
    LoginAttemptService,
    JwtStrategy,
    MfaService,
    StepUpService,
    AuthQrService,
    AuthRfidService,
  ],
  exports: [
    AuthService,
    MfaService,
    StepUpService,
    LoginAttemptService,
    ChallengeService,
  ],
})
export class AuthModule {}
