import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

type ChallengeOp = 'add' | 'sub' | 'mul';

type ChallengePayload = {
  a: number;
  b: number;
  op: ChallengeOp;
  nonce: string;
};

@Injectable()
export class ChallengeService {
  private readonly secret: string;
  private readonly ttlSeconds = 300;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret =
      config.get<string>('AUTH_CHALLENGE_SECRET') ??
      config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private compute(a: number, b: number, op: ChallengeOp): number {
    if (op === 'add') return a + b;
    if (op === 'sub') return a - b;
    return a * b;
  }

  private formatExpression(a: number, b: number, op: ChallengeOp): string {
    if (op === 'add') return `${a} + ${b}`;
    if (op === 'sub') return `${a} - ${b}`;
    return `${a} × ${b}`;
  }

  createChallenge(): { token: string; expression: string } {
    const operators: ChallengeOp[] = ['add', 'sub', 'mul'];
    const op = operators[Math.floor(Math.random() * operators.length)]!;
    let a = Math.floor(Math.random() * 9) + 1;
    let b = Math.floor(Math.random() * 9) + 1;
    if (op === 'sub' && a < b) [a, b] = [b, a];

    const payload: ChallengePayload = {
      a,
      b,
      op,
      nonce: randomUUID(),
    };

    const token = this.jwt.sign(payload, {
      secret: this.secret,
      expiresIn: this.ttlSeconds,
    });

    return { token, expression: this.formatExpression(a, b, op) };
  }

  verify(token: string, answer: number): boolean {
    if (!Number.isFinite(answer)) return false;
    try {
      const payload = this.jwt.verify<ChallengePayload>(token, {
        secret: this.secret,
      });
      if (!payload?.op || !['add', 'sub', 'mul'].includes(payload.op)) {
        return false;
      }
      return (
        this.compute(payload.a, payload.b, payload.op) === Math.trunc(answer)
      );
    } catch {
      return false;
    }
  }
}
