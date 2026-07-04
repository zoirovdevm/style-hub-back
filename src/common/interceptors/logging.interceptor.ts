import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('GraphQL');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo?.();
    const fieldName = info?.fieldName ?? context.getHandler().name;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${fieldName} — ${Date.now() - start}ms`);
      }),
    );
  }
}
