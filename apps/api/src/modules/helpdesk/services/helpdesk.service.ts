import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { SupportTicketService } from './support-ticket.service';

/** Backward-compatible facade used by older callers. */
@Injectable()
export class HelpdeskService {
  constructor(private readonly tickets: SupportTicketService) {}

  create(
    user: JwtUser,
    dto: {
      category?: string;
      subject: string;
      description?: string;
      priority?: string;
    },
  ) {
    return this.tickets.create(user, { ...dto, requesterType: 'STAFF' });
  }

  list(
    tenantId: string,
    query: { status?: string; assigneeUserId?: string } = {},
  ) {
    return this.tickets.list(tenantId, query);
  }

  get(tenantId: string, id: string) {
    return this.tickets.get(tenantId, id, { staff: true });
  }

  assign(user: JwtUser, id: string, assigneeUserId: string) {
    return this.tickets.assign(user, id, assigneeUserId);
  }

  comment(user: JwtUser, id: string, body: string, isInternal = false) {
    return this.tickets.comment(user, id, body, isInternal);
  }

  transition(user: JwtUser, id: string, status: string) {
    return this.tickets.transition(user, id, status);
  }
}
