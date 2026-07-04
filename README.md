# Fashion Marketplace — Backend

NestJS + GraphQL + Prisma backend for a premium fashion e-commerce marketplace.

This is a brand-new, independent project. It does not reuse or modify the existing "MyCar" project in any way.

## Stack
- NestJS (modular architecture, Dependency Injection, Guards, Pipes, Interceptors)
- GraphQL (code-first, Apollo Driver)
- Prisma ORM — SQLite for local development (zero setup: just a file, `prisma/dev.db`, created automatically). Swap to PostgreSQL for production by changing one line in `prisma/schema.prisma` (`provider = "postgresql"`) and setting `DATABASE_URL` to a real connection string — the schema already avoids Postgres-only features so the switch is a one-line change.
- JWT authentication (access + refresh tokens)
- Roles: ADMIN, USER (buyer) — no dealer role
- WebSocket gateway for live "online users" tracking
- Payment module with Click / Payme provider stubs (test-mode ready), easy to plug in real credentials later

## Getting started

`.env` is already created for you with working defaults (SQLite, dev JWT secrets, Click/Payme in test mode) — no account signup or database server needed.

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

GraphQL playground: http://localhost:4000/graphql

## Project layout

```
prisma/schema.prisma        Database schema (Prisma)
src/main.ts                 Bootstrap
src/app.module.ts            Root module
src/common/                  Shared guards, decorators, pipes, interceptors, enums
src/prisma/                  PrismaService (DI wrapper around PrismaClient)
src/modules/auth/            Register/login, JWT strategies
src/modules/user/            User profile
src/modules/category/        Categories CRUD
src/modules/brand/           Brands CRUD
src/modules/product/         Products CRUD, search/filter
src/modules/cart/            Shopping cart
src/modules/wishlist/        Wishlist
src/modules/order/           Orders + status tracking
src/modules/payment/         Click/Payme payment module
src/modules/stats/           Admin dashboard statistics
src/modules/presence/        WebSocket online-user counter
```
