import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.userService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid session');

    // Refreshes lastSeenAt on authenticated activity — touchLastSeen()
    // existed on UserService but was never actually called from anywhere,
    // so it only ever got set once at login, and the admin Users page's
    // per-user "online" dot (which checks "seen in the last 5 minutes")
    // went stale and looked offline almost immediately even while the user
    // was actively browsing. Fire-and-forget (not awaited) and throttled to
    // roughly once a minute per user, since this runs on every single
    // authenticated GraphQL request — awaiting or writing every time would
    // be wasteful.
    const staleMs = 60_000;
    if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt).getTime() > staleMs) {
      this.userService.touchLastSeen(user.id).catch(() => {});
    }

    return user;
  }
}
