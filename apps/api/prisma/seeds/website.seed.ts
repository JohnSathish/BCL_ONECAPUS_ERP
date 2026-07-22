import type { PrismaClient } from '@prisma/client';
import { importWebsiteContent } from '../../src/modules/website/website-content-importer';

export async function seedWebsiteCms(
  prisma: PrismaClient,
  tenantId: string,
  actorId: string,
) {
  const result = await importWebsiteContent(prisma, tenantId, actorId);
  return {
    siteId: result.siteId,
    created: result.pagesCreated,
    pagesTotal: result.pagesTotal,
    menus: 3,
    menuItemsCreated: result.menuItemsCreated,
    contentTypes: result.contentTypes,
    homepageSections: result.homepageSections,
    heroSlidesCreated: result.heroSlidesCreated,
    newsCreated: result.newsCreated,
    noticesCreated: result.noticesCreated,
  };
}
