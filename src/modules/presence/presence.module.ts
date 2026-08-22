import { Module } from '@nestjs/common';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

// PresenceGateway (WebSocket-based) is intentionally no longer wired in
// here — see presence.service.ts for why. The file itself is left in
// place rather than deleted (same as the old review-realtime gateway).
@Module({
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
