import { Body, Controller, Get, Post } from '@nestjs/common';
import { PresenceService } from './presence.service';

/**
 * Plain REST endpoints (not GraphQL, same reasoning as upload.controller.ts)
 * for the heartbeat-based "online now" counter. No auth — this only ever
 * counts anonymous presence and never reads or exposes any user data, so
 * there's nothing here worth gating behind a login.
 */
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Post('heartbeat')
  heartbeat(@Body('clientId') clientId: string) {
    this.presence.heartbeat(clientId || 'anon');
    return { ok: true };
  }

  @Get('online-count')
  onlineCount() {
    return { count: this.presence.getOnlineCount() };
  }
}
