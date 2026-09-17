import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UZ_PHONE_REGEX, normalizePhoneValue } from '../../../common/utils/phone.util';

@InputType()
export class RegisterInput {
  // Email endi MAJBURIY EMAS — ro'yxatdan o'tish telefon raqami bilan
  // amalga oshiriladi (raqam SMS kod orqali tasdiqlanadi, pastdagi
  // `phone` izohiga qarang). Kiritilsa, avvalgidek faqat @gmail.com
  // qabul qilinadi va kichik harfga keltiriladi.
  //
  // Bo'sh qoldirilsa, AuthService raqamdan kelib chiqib ichki
  // (ko'rinmaydigan) manzil yozib qo'yadi — bazadagi `email` ustuni
  // NOT NULL + UNIQUE bo'lgani uchun. Buning uchun migratsiya kerak
  // emas va mavjud hisoblarga umuman tegilmaydi.
  @Field({ nullable: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim() === '' ? undefined : value.trim().toLowerCase()) : value,
  )
  @IsOptional()
  @IsEmail()
  @Matches(/^[^\s@]+@gmail\.com$/, { message: 'Email manzil @gmail.com bilan tugashi kerak' })
  email?: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field()
  @IsString()
  @MinLength(2)
  @Matches(/^[^0-9]+$/, { message: 'Ism raqam bilan yozilishi mumkin emas' })
  firstName: string;

  @Field()
  @IsString()
  @MinLength(2)
  @Matches(/^[^0-9]+$/, { message: 'Familiya raqam bilan yozilishi mumkin emas' })
  lastName: string;

  // Verification already happened in a previous step (sendRegisterOtp +
  // verifyRegisterOtp) — the service checks that a matching, recently-
  // verified PhoneOtp row exists for this exact number before it will
  // create the account, so this field just has to be in the right shape.
  @Field()
  @Transform(({ value }) => normalizePhoneValue(value))
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: 'Telefon raqam +998901234567 formatida bo‘lishi kerak' })
  phone: string;

  // Manzil ham majburiy emas. Ro'yxatdan o'tish imkon qadar qisqa
  // bo'lishi kerak (faqat raqam + ism + parol); manzil birinchi
  // buyurtmada so'raladi va o'sha yerda profilga saqlanadi
  // (checkout sahifasi updateProfile'ni chaqiradi), keyingi
  // buyurtmalarda esa tayyor holda ko'rsatiladi.
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Manzil kiritilishi shart' })
  address?: string;
}
