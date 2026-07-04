import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardStats } from './models/dashboard-stats.model';
import { StatsService } from './stats.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver()
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StatsResolver {
  constructor(private readonly statsService: StatsService) {}

  @Query(() => DashboardStats)
  adminStats() {
    return this.statsService.getDashboard();
  }
}
