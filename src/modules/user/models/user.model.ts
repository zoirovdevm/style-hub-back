import { ObjectType, Field, ID } from '@nestjs/graphql';
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
}
