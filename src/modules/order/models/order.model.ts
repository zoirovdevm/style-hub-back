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

  // Buyurtmaga qo'llangan promokod va undan kelgan chegirma summasi.
  // `totalAmount` — chegirma AYIRILGANDAN keyingi yakuniy summa.
  @Field({ nullable: true })
  promoCode?: string;

  @Field(() => Float, { nullable: true })
  discountAmount?: number;

  @Field(() => [OrderItem])
  items: OrderItem[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
