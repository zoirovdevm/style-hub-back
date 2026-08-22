import { Injectable, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * @nestjs/throttler's default ThrottlerGuard reads the request straight off
 * the HTTP context, which doesn't exist the same way for GraphQL resolvers
 * (everything goes through one /graphql endpoint). This override pulls the
 * real Express req/res out of the GraphQL execution context instead, so
 * rate limiting actually works per-mutation instead of silently doing
 * nothing (or throwing) on every GraphQL call.
 *
 * This guard is registered globally (APP_GUARD in app.module.ts), which
 * means it also runs in front of the plain REST controllers (payment
 * webhooks, image upload, presence heartbeat) — not just GraphQL. Those
 * requests are `context.getType() === 'http'`, and GqlExecutionContext
 * can't pull a { req, res } out of an HTTP context the same way, so this
 * MUST branch on the context type first. Without this check, every REST
 * call (including Click/Payme's payment callbacks) would hit
 * getRequestResponse() with an undefined req/res and throttling would
 * either throw on every single REST request or silently rate-limit
 * nothing at all.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    if (context.getType() === 'http') {
      const http = context.switchToHttp();
      return { req: http.getRequest(), res: http.getResponse() };
    }
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    return { req: ctx.req, res: ctx.res };
  }
}
