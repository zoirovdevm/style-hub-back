import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryInput, UpdateCategoryInput } from './dto/category.input';

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
    return this.prisma.category.create({
      data: { ...input, slug: slugify(input.name, { lower: true, strict: true }) },
    });
  }

  async update(id: string, input: UpdateCategoryInput) {
    await this.findById(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...input,
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
