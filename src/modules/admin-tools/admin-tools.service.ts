import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminToolsService {
  constructor(private readonly prisma: PrismaService) {}

  // Wipes every "content" table so an admin can reset a demo/test store
  // back to empty without touching real user accounts. Order matters here:
  // children before parents, even though several relations already cascade
  // on delete at the DB level (Order -> OrderItem/Payment, Product ->
  // ProductVariant/CartItem/WishlistItem) — deleting explicitly in
  // dependency order works regardless of whether every cascade is wired up,
  // instead of relying on it.
  async clearAllData() {
    await this.prisma.$transaction([
      this.prisma.payment.deleteMany(),
      this.prisma.orderItem.deleteMany(),
      this.prisma.order.deleteMany(),
      this.prisma.cartItem.deleteMany(),
      this.prisma.wishlistItem.deleteMany(),
      this.prisma.productVariant.deleteMany(),
      this.prisma.product.deleteMany(),
      this.prisma.category.deleteMany(),
      this.prisma.brand.deleteMany(),
    ]);
    // Deliberately NOT touched: User (accounts/admins must survive a reset)
    // and SiteSettings (the hero banner an admin just uploaded shouldn't
    // vanish just because they cleared out test products/orders).
    return true;
  }

  // Xuddi clearAllData() kabi, lekin katalogga (Product/Category/Brand/
  // ProductVariant) TEGMAYDI — faqat "faoliyat" ma'lumotlari: buyurtmalar,
  // to'lovlar, savat va sevimlilar ro'yxati o'chadi. Admin dashboardni sinov
  // uchun tozalashda mahsulotlarni har safar qaytadan qo'shishga majbur
  // bo'lmasligi uchun qo'shilgan.
  async clearOrdersData() {
    await this.prisma.$transaction([
      this.prisma.payment.deleteMany(),
      this.prisma.orderItem.deleteMany(),
      this.prisma.order.deleteMany(),
      this.prisma.cartItem.deleteMany(),
      this.prisma.wishlistItem.deleteMany(),
    ]);
    // Mahsulotlarning soldCount/viewCount/rating kabi hisoblangan maydonlari
    // shu buyurtmalar asosida to'lgan edi — ular ham 0'ga qaytariladi,
    // aks holda "23 marta sotilgan" degan raqam endi mavjud bo'lmagan
    // buyurtmalarga ishora qilib, chalkash bo'lib qolardi.
    await this.prisma.product.updateMany({ data: { soldCount: 0 } });
    return true;
  }
}
