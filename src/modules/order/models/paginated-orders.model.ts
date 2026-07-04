import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Order } from './order.model';

@ObjectType()
export class PaginatedOrders {
  @Field(() => [Order])
  list: Order[];

  @Field(() => Int)
  total: number;
}
