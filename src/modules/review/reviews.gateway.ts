import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'ws';

/**
 * Broadcasts newly-created reviews to everyone currently browsing, in real
 * time — mirrors the same plain-WebSocket pattern already used by
 * PresenceGateway (src/modules/presence/presence.gateway.ts) for the
 * "online now" counter, just on its own path so it doesn't interfere with
 * that counter's connection/disconnect accounting.
 *
 * The frontend (ProductReviews.tsx) connects here, filters incoming
 * messages by productId client-side, and merges the review straight into
 * its Apollo cache — that's what lets a review posted by one user show up
 * for everyone else already on that product page, without a page reload.
 */
@WebSocketGateway({ path: '/ws/reviews' })
export class ReviewsGateway {
  @WebSocketServer()
  server: Server;

  broadcastNewReview(productId: string, review: unknown) {
    if (!this.server?.clients) return;
    const payload = JSON.stringify({ type: 'REVIEW_ADDED', productId, review });
    this.server.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }
}
