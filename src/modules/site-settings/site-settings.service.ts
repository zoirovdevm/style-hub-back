import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSiteSettingsInput } from './dto/update-site-settings.input';

// Fixed id for the one-and-only settings row — there is never more than one,
// so instead of a real "find the current settings" concept we always
// read/write this exact id.
const SETTINGS_ID = 'singleton';

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // upsert (not findUnique) so the very first call — before any admin has
  // ever saved anything — still returns a row instead of null, keeping the
  // GraphQL query simple for the frontend (no "settings might be null" check).
  getSettings() {
    return this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  updateSettings(input: UpdateSiteSettingsInput) {
    return this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: input,
      create: { id: SETTINGS_ID, ...input },
    });
  }
}
