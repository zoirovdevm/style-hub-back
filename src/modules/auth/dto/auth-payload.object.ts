import { ObjectType, Field } from '@nestjs/graphql';
import { User } from '../../user/models/user.model';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => User)
  user: User;
}
