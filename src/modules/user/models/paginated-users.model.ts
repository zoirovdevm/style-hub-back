import { ObjectType, Field, Int } from '@nestjs/graphql';
import { User } from './user.model';

@ObjectType()
export class PaginatedUsers {
  @Field(() => [User])
  list: User[];

  @Field(() => Int)
  total: number;
}
