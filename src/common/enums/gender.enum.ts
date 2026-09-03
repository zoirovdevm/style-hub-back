import { registerEnumType } from '@nestjs/graphql';

// Mahsulot kimga mo'ljallangan: Erkaklar / Ayollar / Unisex (ikkalasi ham).
// Yangi mahsulotlar UNISEX bilan boshlanadi — admin xohlagan tovarlarni
// keyinchalik ProductForm'dagi tanlov orqali Erkaklar/Ayollar'ga o'tkazadi.
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNISEX = 'UNISEX',
}
registerEnumType(Gender, { name: 'Gender' });
