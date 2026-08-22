import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Product } from '../../product/models/product.model';

// Bitta magazin bo'yicha yig'ma raqamlar — magazinlar ro'yxati sahifasidagi
// kartochkalar va magazin ichidagi statistika paneli uchun.
@ObjectType()
export class StoreStats {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  // Ombor botiga kirish kodi — admin buni faqat shu magazinchiga beradi
  @Field({ nullable: true })
  accessCode?: string;

  // Botga shu magazin kodi bilan ulangan Telegram akkauntlar
  @Field(() => [String])
  sellers: string[];

  // Shu magazindan qo'shilgan (aktiv) tovarlar soni
  @Field(() => Int)
  totalProducts: number;

  // Shu magazin tovarlarining ombordagi jami soni
  @Field(() => Int)
  totalStock: number;

  // Shu magazin tovarlaridan jami nechta dona sotilgan (faqat to'langan
  // buyurtmalar — product.soldCount bilan bir xil mantiq)
  @Field(() => Int)
  totalSold: number;

  // Shu magazin tovarlaridan tushgan jami tushum (to'langan buyurtmalar
  // bo'yicha, narx x soni)
  @Field(() => Float)
  revenue: number;

  // Admin shu magazinchi bilan ishlaydigan komissiya foizi (admin
  // tomonidan sozlanadi — updateStore mutatsiyasi orqali).
  @Field(() => Float)
  commissionPercent: number;

  // "Mening ulushim" — revenue * commissionPercent / 100. Masalan
  // commissionPercent=20 bo'lsa, tushumning 20% shu yerda ko'rsatiladi.
  @Field(() => Float)
  myShare: number;

  // Kam qolgan tovarlar soni (ombordagi soni 5 va undan kam)
  @Field(() => Int)
  lowStockCount: number;
}

// Magazin ichki sahifasi uchun: statistika + tovarlar ro'yxati bitta
// so'rovda.
@ObjectType()
export class StoreOverview {
  @Field(() => StoreStats)
  stats: StoreStats;

  @Field(() => [Product])
  products: Product[];
}
