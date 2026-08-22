import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class CreateReviewInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Field(() => Int)
  @IsIn([1, 2, 3, 4, 5])
  rating: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  comment: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  image?: string;
}
