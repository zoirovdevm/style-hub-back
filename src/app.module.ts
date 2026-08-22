import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import configuration from './config/configuration';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CategoryModule } from './modules/category/category.module';
import { BrandModule } from './modules/brand/brand.module';
import { ProductModule } from './modules/product/product.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PresenceModule } from './modules/presence/presence.module';
import { StatsModule } from './modules/stats/stats.module';
import { UploadModule } from './modules/upload/upload.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module';
import { AdminToolsModule } from './modules/admin-tools/admin-tools.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ReviewModule } from './modules/review/review.module';
import { StoreModule } from './modules/store/store.module';
import { StockBotModule } from './modules/stock-bot/stock-bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Global rate limit: 30 requests / 60s per IP by default. Sensitive
    // auth mutations (login, register, password reset, etc.) additionally
    // apply a much tighter @Throttle({ limit: 5, ttl: 60_000 }) override —
    // see auth.resolver.ts. Without this, anyone could brute-force
    // passwords or spam verification-code emails with no limit at all.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    CategoryModule,
    BrandModule,
    ProductModule,
    CartModule,
    WishlistModule,
    OrderModule,
    PaymentModule,
    PresenceModule,
    StatsModule,
    UploadModule,
    SiteSettingsModule,
    AdminToolsModule,
    TelegramModule,
    ReviewModule,
    StoreModule,
    StockBotModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
