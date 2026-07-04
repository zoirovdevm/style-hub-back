import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Product } from './models/product.model';
import { PaginatedProducts } from './models/paginated-products.model';
import { ProductService } from './product.service';
import { CreateProductInput, UpdateProductInput } from './dto/product.input';
import { ProductFilterInput } from './dto/product-filter.input';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => Product)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Public()
  @Query(() => PaginatedProducts)
  products(@Args('filter') filter: ProductFilterInput) {
    return this.productService.findAll(filter);
  }

  @Public()
  @Query(() => Product)
  product(@Args('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Public()
  @Query(() => [Product])
  bestSellers(@Args('limit', { type: () => Number, nullable: true }) limit?: number) {
    return this.productService.bestSellers(limit ?? 5);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Product)
  createProduct(@Args('input') input: CreateProductInput) {
    return this.productService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Product)
  updateProduct(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateProductInput) {
    return this.productService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removeProduct(@Args('id', { type: () => ID }) id: string) {
    return this.productService.remove(id);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => [Product])
  lowStockProducts(@Args('threshold', { type: () => Number, nullable: true }) threshold?: number) {
    return this.productService.lowStock(threshold ?? 5);
  }
}
