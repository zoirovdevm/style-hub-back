import { Resolver, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminToolsService } from './admin-tools.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver()
export class AdminToolsResolver {
  constructor(private readonly adminToolsService: AdminToolsService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  clearAllData() {
    return this.adminToolsService.clearAllData();
  }

  // Mahsulotlarga tegmaydigan, "yumshoqroq" tozalash — faqat buyurtma/
  // to'lov/savat/sevimlilar.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  clearOrdersData() {
    return this.adminToolsService.clearOrdersData();
  }
}
