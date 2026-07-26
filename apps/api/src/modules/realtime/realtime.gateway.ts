import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';

type SocketUser = {
  sub: string;
  tid: string;
  email: string;
};

type SocketData = {
  user?: SocketUser;
};

type AppSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — Socket.IO running without Redis adapter',
      );
      return;
    }

    try {
      const pub = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      const sub = pub.duplicate();
      server.adapter(createAdapter(pub, sub));
      this.logger.log('Socket.IO Redis adapter enabled');
    } catch (err) {
      this.logger.warn(`Redis adapter unavailable: ${String(err)}`);
    }
  }

  async handleConnection(client: Socket) {
    const authed = client as AppSocket;
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwt.verifyAsync<SocketUser>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      authed.data.user = payload;
      void authed.join(`tenant:${payload.tid}`);
      void authed.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AppSocket) {
    return {
      event: 'pong',
      data: { ts: Date.now(), userId: client.data.user?.sub },
    };
  }

  broadcastToTenant(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  broadcastToRoom(room: string, event: string, payload: unknown) {
    this.server.to(room).emit(event, payload);
  }

  notifyUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  @SubscribeMessage('competition:join-meet')
  handleJoinMeet(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { meetId?: string },
  ) {
    const meetId = body?.meetId?.trim();
    if (!meetId || !client.data.user?.tid) return { ok: false };
    void client.join(`meet:${meetId}`);
    return { ok: true, room: `meet:${meetId}` };
  }

  @SubscribeMessage('competition:leave-meet')
  handleLeaveMeet(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { meetId?: string },
  ) {
    const meetId = body?.meetId?.trim();
    if (!meetId) return { ok: false };
    void client.leave(`meet:${meetId}`);
    return { ok: true };
  }

  @SubscribeMessage('support:join-thread')
  handleJoinSupportThread(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { threadId?: string },
  ) {
    const threadId = body?.threadId?.trim();
    if (!threadId || !client.data.user?.tid) return { ok: false };
    void client.join(`support:thread:${threadId}`);
    return { ok: true, room: `support:thread:${threadId}` };
  }

  @SubscribeMessage('support:leave-thread')
  handleLeaveSupportThread(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { threadId?: string },
  ) {
    const threadId = body?.threadId?.trim();
    if (!threadId) return { ok: false };
    void client.leave(`support:thread:${threadId}`);
    return { ok: true };
  }

  @SubscribeMessage('support:typing')
  handleSupportTyping(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { threadId?: string; isTyping?: boolean },
  ) {
    const threadId = body?.threadId?.trim();
    const user = client.data.user;
    if (!threadId || !user) return { ok: false };
    this.broadcastToRoom(`support:thread:${threadId}`, 'support.typing', {
      threadId,
      userId: user.sub,
      isTyping: body.isTyping !== false,
    });
    return { ok: true };
  }

  @SubscribeMessage('announcement')
  handleAnnouncement(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { message: string },
  ) {
    const tid = client.data.user?.tid;
    if (!tid) return;
    this.broadcastToTenant(tid, 'announcement', {
      message: body.message,
      from: client.data.user?.email,
      ts: new Date().toISOString(),
    });
  }
}
