import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class PaymentUrlResult {
  @Field()
  payUrl: string;
}
