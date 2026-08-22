import { Injectable } from '@nestjs/common';

// How long a heartbeat "counts" before that visitor is considered gone.
// The frontend pings every 20s, so 45s gives enough slack for one missed
// beat (a slow request, a brief network hiccup) without the count
// flickering down and back up every few seconds.
const HEARTBEAT_TTL_MS = 45_000;

/**
 * Tracks "online now" presence via a simple heartbeat pattern instead of a
 * persistent WebSocket connection. The original WebSocket-based
 * PresenceGateway (see presence.gateway.ts, no longer wired into
 * PresenceModule) proved unreliable for the same reason the live-review
 * WebSocket did: Next.js's dev-mode rewrites don't proxy WS upgrade
 * requests, so it only worked when NEXT_PUBLIC_WS_PRESENCE_URL pointed
 * directly at the backend — and on this Windows setup that URL kept
 * resolving to a dead/wrong address, so the socket never connected and the
 * "online now" counter stayed stuck at null forever.
 *
 * A plain in-memory map is enough here — presence is inherently soft
 * real-time data (losing it on a backend restart is fine, it just
 * repopulates within one heartbeat cycle) and doesn't need a database
 * round-trip.
 */
@Injectable()
export class PresenceService {
  private lastSeen = new Map<string, number>();

  heartbeat(clientId: string) {
    this.lastSeen.set(clientId, Date.now());
  }

  getOnlineCount(): number {
    const cutoff = Date.now() - HEARTBEAT_TTL_MS;
    for (const [id, ts] of this.lastSeen) {
      if (ts < cutoff) this.lastSeen.delete(id);
    }
    return this.lastSeen.size;
  }
}
