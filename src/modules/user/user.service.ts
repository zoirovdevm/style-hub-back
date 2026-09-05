import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileInput } from './dto/update-profile.input';
import { UsersFilterInput } from './dto/users-filter.input';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return this.prisma.user.update({ where: { id: userId }, data: input });
  }

  async touchLastSeen(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  }

  async findAll(filter: UsersFilterInput) {
    const where: any = {};
    if (filter.role) where.role = filter.role;
    if (filter.search) {
      // SQLite's Prisma connector doesn't support `mode: 'insensitive'`
      // (that's a Postgres/Mongo-only option) — SQLite's default `contains`
      // is already case-insensitive for ASCII text, which covers our data.
      where.OR = [
        { email: { contains: filter.search } },
        { firstName: { contains: filter.search } },
        { lastName: { contains: filter.search } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Flatten Prisma's `_count.orders` into the plain `ordersCount` field
    // the GraphQL User type exposes.
    const list = rows.map(({ _count, ...user }) => ({ ...user, ordersCount: _count.orders }));

    return { list, total };
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id); // 404s if the id doesn't exist
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  // Butunlay o'chirish — blokdan farqli o'laroq, bu foydalanuvchini bazadan
  // butunlay olib tashlaydi, shuning uchun uning telefon raqami/email'i
  // darhol bo'shab qoladi va o'sha raqam/email bilan qaytadan ro'yxatdan
  // o'tish mumkin bo'ladi (blok esa qatorni bazada saqlab qolgani uchun
  // unique cheklov hali ham band bo'lib turaverar edi).
  //
  // Savat/sevimlilar/sharhlar avtomatik o'chadi (schema.prisma'da shu
  // relationlar uchun onDelete: Cascade bor). Lekin buyurtmalar (Order)
  // ataylab cascade qilinmagan — bitta buyurtma qilgan haqiqiy xaridorni
  // o'chirish butun buyurtma tarixini yo'qotib yubormasligi kerak. Shuning
  // uchun buyurtma tarixi bor foydalanuvchini o'chirishga urinish
  // tushunarli xabar bilan rad etiladi (xuddi hardDeleteProduct'dagi kabi)
  // — bunday hollarda admin blok qilishda davom etishi kerak.
  async remove(id: string): Promise<boolean> {
    await this.findById(id);
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      const e = error as { code?: string };
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new BadRequestException(
          "Bu foydalanuvchi buyurtma tarixiga ega, shuning uchun butunlay o'chirib bo'lmaydi. Uni bloklashingiz mumkin.",
        );
      }
      throw error;
    }
  }

  countAll() {
    return this.prisma.user.count();
  }

  countByRole(role: Role) {
    return this.prisma.user.count({ where: { role } });
  }
}
