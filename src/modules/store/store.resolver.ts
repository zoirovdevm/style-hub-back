import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Store } from './models/store.model';
import { StoreStats, StoreOverview } from './models/store-stats.model';
import { StoreService } from './store.service';
import { CreateStoreInput, UpdateStoreInput } from './dto/store.input';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// DIQQAT: brand/categorydan farqli ravishda bu resolver'da @Public() yo'q —
// magazinlar ro'yxati ham, mutatsiyalari ham FAQAT admin uchun. Oddiy
// foydalanuvchi yoki mehmon "stores" so'rovini bersa — ruxsat berilmaydi.
@Resolver(() => Store)
export class StoreResolver {
  constructor(private readonly storeService: StoreService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => [Store])
  stores() {
    return this.storeService.findAll();
  }

  // Magazinlar ro'yxati + har birining raqamlari (tovar soni, sotilgani,
  // kam qolgani, tushumi) — ro'yxat sahifasidagi kartochkalar uchun.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => [StoreStats])
  storesStats() {
    return this.storeService.statsForAll();
  }

  // Bitta magazinning ichki sahifasi: statistika + tovarlar ro'yxati.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => StoreOverview)
  storeOverview(@Args('id', { type: () => ID }) id: string) {
    return this.storeService.overview(id);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Store)
  createStore(@Args('input') input: CreateStoreInput) {
    return this.storeService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Store)
  updateStore(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateStoreInput) {
    return this.storeService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removeStore(@Args('id', { type: () => ID }) id: string) {
    return this.storeService.remove(id);
  }

  // Bot kirish kodini almashtirish — yangi kod qaytaradi, eskisi darhol
  // ishlamay qoladi.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => String)
  regenerateStoreCode(@Args('id', { type: () => ID }) id: string) {
    return this.storeService.regenerateAccessCode(id);
  }

  // Magazinga ulangan barcha Telegram sotuvchilarni uzish.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  revokeStoreSellers(@Args('id', { type: () => ID }) id: string) {
    return this.storeService.revokeSellers(id);
  }
}
