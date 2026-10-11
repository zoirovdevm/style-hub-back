import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OmborService, OmborSession } from './ombor.service';

// Ombor Mini App so'rovlari uchun himoya. `Authorization: Bearer <token>`
// sarlavhasidagi sessiya tokeni tekshiriladi (imzo, muddat va magazinga
// bog'lanish bazada hali ham borligi — OmborService.verifySessionToken).
// Natija `req.omborSession` ga yoziladi va @CurrentOmborSession() orqali
// olinadi.
@Injectable()
export class OmborAuthGuard implements CanActivate {
  constructor(private readonly ombor: OmborService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('SESSION_EXPIRED');
    req.omborSession = await this.ombor.verifySessionToken(token);
    return true;
  }
}

export const CurrentOmborSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OmborSession => context.switchToHttp().getRequest().omborSession,
);
