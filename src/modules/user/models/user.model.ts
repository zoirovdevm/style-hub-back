import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Role } from '../../../common/enums/role.enum';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  firstName: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  address?: string;

  @Field(() => Role)
  role: Role;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  lastSeenAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Not a real DB column — resolved from the `orders` relation count in
  // UserService.findAll() (via Prisma's `_count`). Lets the admin Users
  // table show "how many orders has this person placed" without a
  // separate query per row.
  @Field(() => Int, { nullable: true })
  ordersCount?: number;
}
