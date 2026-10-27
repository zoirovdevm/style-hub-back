import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Category } from './models/category.model';
import { CategoryService, parseSizeOptions } from './category.service';
import { CreateCategoryInput, UpdateCategoryInput } from './dto/category.input';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => Category)
export class CategoryResolver {
  constructor(private readonly categoryService: CategoryService) {}

  // Bazada JSON matn turadi — GraphQL'ga ro'yxat bo'lib chiqadi. Category
  // qayerda qaytmasin (masalan Product.category ichida ham) shu ishlaydi.
  @ResolveField(() => [String], { nullable: true })
  sizeOptions(@Parent() category: { sizeOptions?: string | string[] | null }) {
    const raw = category.sizeOptions;
    if (Array.isArray(raw)) return raw;
    return parseSizeOptions(raw ?? null);
  }

  @Public()
  @Query(() => [Category])
  categories() {
    return this.categoryService.findAll(true);
  }

  @Public()
  @Query(() => Category)
  category(@Args('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Category)
  createCategory(@Args('input') input: CreateCategoryInput) {
    return this.categoryService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Category)
  updateCategory(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateCategoryInput) {
    return this.categoryService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removeCategory(@Args('id', { type: () => ID }) id: string) {
    return this.categoryService.remove(id);
  }
}
