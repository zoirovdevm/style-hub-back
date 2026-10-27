import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryInput, UpdateCategoryInput } from './dto/category.input';

// Admin kiritgan o'lchamlarni tozalaydi: bo'sh joylar olib tashlanadi,
// takrorlar o'chiriladi, tartib saqlanadi. null → avtomatik rejim.
export function serializeSizeOptions(list: string[] | null | undefined): string | null | undefined {
  if (list === undefined) return undefined;
  if (list === null) return null;
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of list) {
    const v = String(raw ?? '').trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    clean.push(v);
  }
  return JSON.stringify(clean);
}

// Bazadagi JSON matn → ro'yxat. Buzilgan qiymat avtomatik rejim deb olinadi.
export function parseSizeOptions(raw: string | null | undefined): string[] | null {
  if (raw == null) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : null;
  } catch {
    return null;
  }
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(onlyActive = false) {
    return this.prisma.category.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  create(input: CreateCategoryInput) {
    const { sizeOptions, ...rest } = input;
    return this.prisma.category.create({
      data: {
        ...rest,
        sizeOptions: serializeSizeOptions(sizeOptions) ?? null,
        slug: slugify(input.name, { lower: true, strict: true }),
      },
    });
  }

  async update(id: string, input: UpdateCategoryInput) {
    await this.findById(id);
    const { sizeOptions, ...rest } = input;
    const serialized = serializeSizeOptions(sizeOptions);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...rest,
        // undefined — maydon yuborilmagan, bazadagi qiymat o'zgarmaydi.
        ...(serialized !== undefined ? { sizeOptions: serialized } : {}),
        ...(input.name ? { slug: slugify(input.name, { lower: true, strict: true }) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.category.delete({ where: { id } });
    return true;
  }
}
