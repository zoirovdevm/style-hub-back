import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class SiteSettings {
  @Field()
  id: string;

  // URL of the home page hero/banner image (e.g. "/uploads/products/xxx.jpg"),
  // set by an admin from the admin panel. Null until the first upload — the
  // frontend falls back to the built-in placeholder illustration in that case.
  @Field({ nullable: true })
  heroImage?: string;

  // Contact page details, editable from the admin panel — null until an
  // admin fills them in, in which case the Contact page falls back to its
  // original hardcoded defaults.
  @Field({ nullable: true })
  contactAddress?: string;

  @Field({ nullable: true })
  contactPhone?: string;

  @Field({ nullable: true })
  contactTelegram?: string;

  @Field({ nullable: true })
  contactEmail?: string;

  @Field()
  updatedAt: Date;
}
