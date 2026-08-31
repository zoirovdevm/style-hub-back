import { ObjectType, Field } from '@nestjs/graphql';

// One color's dedicated photo set (admin-uploaded via ProductForm's
// "Rang bo'yicha rasmlar" section). See Product.colorImages — stored as a
// JSON-encoded array of these, same SQLite-has-no-array-type pattern as
// sizes/colors/images.
@ObjectType()
export class ColorImages {
  @Field()
  color: string;

  @Field(() => [String])
  images: string[];
}
