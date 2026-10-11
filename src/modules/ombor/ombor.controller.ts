import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OmborService, OmborSession } from './ombor.service';
import { CurrentOmborSession, OmborAuthGuard } from './ombor-auth.guard';
import { DeductDto, InitDataDto, LoginDto } from './dto/ombor.dto';

// Wardrobe Ombor Telegram Mini App uchun REST API.
//
// Nima uchun GraphQL emas: Mini App juda kichik va mustaqil — Apollo
// mijozini yuklamasdan oddiy `fetch` bilan ishlaydi; to'lov webhooklari,
// rasm yuklash va presence kabi bu loyihadagi boshqa REST
// controllerlari bilan bir xil yondashuv.
//
// Frontend bu manzilni o'zining `/ombor-api/*` yo'li orqali chaqiradi
// (next.config.js rewrites), ya'ni Mini App va API bitta domenda.
@Controller('ombor-api')
export class OmborController {
  constructor(private readonly ombor: OmborService) {}

  // Mini App ochilganda: oldin kod kiritilgan bo'lsa — sessiya, aks holda
  // `authenticated: false` (login sahifasi ko'rsatiladi).
  @Post('session')
  @HttpCode(200)
  session(@Body() body: InitDataDto) {
    return this.ombor.session(body.initData);
  }

  // Magazin kodi bilan kirish. Global IP cheklovidan tashqari bu yerda
  // qattiqroq IP cheklovi (daqiqasiga 10) va servis ichida Telegram
  // foydalanuvchisi bo'yicha cheklov (15 daqiqada 5 xato) ishlaydi.
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: LoginDto) {
    return this.ombor.login(body.initData, body.code);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(OmborAuthGuard)
  logout(@CurrentOmborSession() session: OmborSession) {
    return this.ombor.logout(session);
  }

  @Get('me')
  @UseGuards(OmborAuthGuard)
  me(@CurrentOmborSession() session: OmborSession) {
    return this.ombor.me(session);
  }

  @Get('products')
  @UseGuards(OmborAuthGuard)
  products(
    @CurrentOmborSession() session: OmborSession,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.ombor.products(session, q?.slice(0, 100), categoryId?.slice(0, 64));
  }

  @Get('products/:id')
  @UseGuards(OmborAuthGuard)
  product(@CurrentOmborSession() session: OmborSession, @Param('id') id: string) {
    return this.ombor.product(session, id);
  }

  @Get('categories')
  @UseGuards(OmborAuthGuard)
  categories(@CurrentOmborSession() session: OmborSession) {
    return this.ombor.categories(session);
  }

  @Post('deduct')
  @HttpCode(200)
  @UseGuards(OmborAuthGuard)
  deduct(@CurrentOmborSession() session: OmborSession, @Body() body: DeductDto) {
    return this.ombor.deduct(session, body);
  }
}
