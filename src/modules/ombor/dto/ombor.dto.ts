import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

// DIQQAT: global ValidationPipe `whitelist: true` bilan ishlaydi — dekoratori
// yo'q maydon so'rovdan jimgina o'chirib tashlanadi. Shuning uchun har bir
// maydonda kamida bitta class-validator dekoratori bo'lishi SHART.

export class InitDataDto {
  @IsString()
  @MinLength(10)
  @MaxLength(8192)
  initData: string;
}

export class LoginDto extends InitDataDto {
  // Magazin kodi. Bu yerda faqat o'lchami cheklanadi — tekshiruvning o'zi
  // serverda, bazadagi `Store.accessCode` bilan.
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  code: string;
}

export class DeductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity: number;

  // Har bir "olib tashlash" urinishi uchun brauzer yaratadigan noyob
  // identifikator. Bitta tugma ikki marta bosilsa yoki tarmoq so'rovni
  // qayta yuborsa, server ikkinchisini YANGI ayirish deb emas, o'sha
  // birinchisining takrori deb taniydi va qoldiqdan ikki marta ayirmaydi.
  @IsUUID()
  requestId: string;
}
