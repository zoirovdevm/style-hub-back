import { Resolver, Query, Mutation, Args, ID, InputType, Field, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PromoCode, PromoCodePreview } from './models/promo-code.model';
import { PromoCodeService } from './promo-code.service';
import { CreatePromoCodeInput, UpdatePromoCodeInput } from './dto/promo-code.input';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../user/models/user.model';

// To'lovdan oldingi tekshiruv uchun kirish ma'lumoti. Maydonlar
// CreateOrderInput bilan ataylab bir xil nomlanган — checkout sahifasi
// buyurtma yaratishda nimani yuborsa, tekshiruvda ham AYNAN o'shani
// yuboradi, ya'ni ko'rsatilgan chegirma bilan yozib qo'yiladigani hech
// qachon farq qilmaydi.
@InputType()
export class PromoCodeCheckInput {
  @Field()
  @IsString()
  code: string;

  @Field()
  @IsString()
  phone: string;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  buyNowProductId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buyNowSize?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buyNowColor?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  buyNowQuantity?: number;
}

@Resolver(() => PromoCode)
export class PromoCodeResolver {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  // ── Admin ──
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => [PromoCode])
  adminPromoCodes() {
    return this.promoCodeService.findAll();
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => PromoCode)
  createPromoCode(@Args('input') input: CreatePromoCodeInput) {
    return this.promoCodeService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => PromoCode)
  updatePromoCode(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePromoCodeInput,
  ) {
    return this.promoCodeService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removePromoCode(@Args('id', { type: () => ID }) id: string) {
    return this.promoCodeService.remove(id);
  }

  // ── Xaridor: kodni tekshirish ──
  // Xatolik OTILMAYDI — kod noto'g'ri bo'lishi oddiy holat, shuning uchun
  // javobda `valid: false` va sababi qaytariladi.
  @UseGuards(GqlAuthGuard)
  @Mutation(() => PromoCodePreview)
  async checkPromoCode(@CurrentUser() user: User, @Args('input') input: PromoCodeCheckInput) {
    const items = await this.promoCodeService.resolveItems(user.id, input);
    const result = await this.promoCodeService.evaluate(input.code, input.phone, items);
    return {
      valid: result.valid,
      code: result.code ?? null,
      message: result.message ?? null,
      eligibleAmount: result.eligibleAmount,
      discount: result.discount,
      total: result.total,
    };
  }
}
