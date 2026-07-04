import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';

/**
 * Tracks currently-connected clients so the admin dashboard can show a
 * live "online now" counter. The frontend opens a plain WebSocket
 * connection to this gateway on page load (no auth required — it only
 * counts presence, it doesn't expose any data).
 */
@WebSocketGateway({ path: '/ws/presence' })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('PresenceGateway');
  private onlineCount = 0;

  handleConnection(client: WebSocket) {
    this.onlineCount += 1;
    this.broadcastCount();
  }

  handleDisconnect(client: WebSocket) {
    this.onlineCount = Math.max(0, this.onlineCount - 1);
    this.broadcastCount();
  }

  getOnlineCount(): number {
    return this.onlineCount;
  }

  private broadcastCount() {
    if (!this.server?.clients) return;
    const payload = JSON.stringify({ type: 'ONLINE_COUNT', count: this.onlineCount });
    this.server.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }
}
