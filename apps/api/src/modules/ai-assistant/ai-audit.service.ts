import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AiAuditService {
  private readonly logger = new Logger(AiAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    tenantId: string;
    userId: string;
    sessionId?: string;
    question?: string;
    intent?: unknown;
    tools?: unknown;
    resultSummary?: string;
  }) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO platform.ai_assistant_audit_logs
          (id, tenant_id, user_id, session_id, question, intent, tools, result_summary, created_at)
        VALUES (
          gen_random_uuid(),
          ${input.tenantId}::uuid,
          ${input.userId}::uuid,
          ${input.sessionId ?? null},
          ${input.question ?? null},
          ${JSON.stringify(input.intent ?? null)}::jsonb,
          ${JSON.stringify(input.tools ?? null)}::jsonb,
          ${input.resultSummary ?? null},
          NOW()
        )
      `;
    } catch (err) {
      this.logger.warn(
        `AI audit log failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
