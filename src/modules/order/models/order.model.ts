import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../../common/enums/order.enum';
import { OrderItem } from './order-item.model';
import { User } from '../../user/models/user.model';

@ObjectType()
export class Order {
  @Field(() => ID)
  id: string;

  @Field()
  orderNumber: string;

  @Field(() => ID)
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => Float)
  totalAmount: number;

  @Field()
  deliveryAddress: string;

  @Field({ nullable: true })
  deliveryCity?: string;

  @Field()
  phone: string;

  @Field({ nullable: true })
  note?: string;

  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @Field(() => PaymentStatus)
  paymentStatus: PaymentStatus;

  @Field(() => [OrderItem])
  items: OrderItem[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
