import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { BadRequestException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from './telegram.service';
import { ContactMessageInput } from './dto/contact-message.input';

@Resolver()
export class TelegramResolver {
  constructor(private readonly telegramService: TelegramService) {}

  // Public: the Contact page form must work for anyone, logged in or not.
  @Public()
  @Mutation(() => Boolean)
  async sendContactMessage(@Args('input') input: ContactMessageInput) {
    try {
      await this.telegramService.notifyContactMessage(input.name, input.contact, input.message);
      return true;
    } catch (error) {
      throw new BadRequestException((error as Error).message || "Xabar yuborilmadi, keyinroq urinib ko'ring.");
    }
  }
}
