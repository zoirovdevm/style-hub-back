import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGenderInput, UpdateGenderInput } from './dto/gender.input';

@Injectable()
export class GenderService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.gender.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const gender = await this.prisma.gender.findUnique({ where: { id } });
    if (!gender) throw new NotFoundException('Gender not found');
    return gender;
  }

  create(input: CreateGenderInput) {
    return this.prisma.gender.create({
      data: { ...input, slug: slugify(input.name, { lower: true, strict: true }) },
    });
  }

  async update(id: string, input: UpdateGenderInput) {
    await this.findById(id);
    return this.prisma.gender.update({
      where: { id },
      data: {
        ...input,
        ...(input.name ? { slug: slugify(input.name, { lower: true, strict: true }) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.gender.delete({ where: { id } });
    return true;
  }
}
