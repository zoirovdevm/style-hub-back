import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateSiteSettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  heroImage?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contactAddress?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contactTelegram?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  socialTelegram?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  socialInstagram?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  socialTiktok?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentCardNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentCardHolder?: string;
}
