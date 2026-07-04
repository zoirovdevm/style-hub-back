import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

@InputType()
export class UsersFilterInput {
  @Field(() => Role, { nullable: true })
  @IsOptional()
  role?: Role;

  @Field({ nullable: true })
  @IsOptional()
  search?: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  limit: number;
}
