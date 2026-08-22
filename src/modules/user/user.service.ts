import { Injectable, NotFoundException } from '@nestjs/common';
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

  countAll() {
    return this.prisma.user.count();
  }

  countByRole(role: Role) {
    return this.prisma.user.count({ where: { role } });
  }
}
