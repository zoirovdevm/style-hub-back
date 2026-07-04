import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandInput, UpdateBrandInput } from './dto/brand.input';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  create(input: CreateBrandInput) {
    return this.prisma.brand.create({
      data: { ...input, slug: slugify(input.name, { lower: true, strict: true }) },
    });
  }

  async update(id: string, input: UpdateBrandInput) {
    await this.findById(id);
    return this.prisma.brand.update({
      where: { id },
      data: {
        ...input,
        ...(input.name ? { slug: slugify(input.name, { lower: true, strict: true }) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.brand.delete({ where: { id } });
    return true;
  }
}
