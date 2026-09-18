import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURES = [
  'GST-compliant invoice generation',
  'Customer management',
  'Product & service management',
  'HSN/SAC codes',
  'GST rates and tax calculations',
  'CGST / SGST / IGST',
  'Invoice numbering',
  'Quotations & estimates',
  'Purchase management',
  'Sales management',
  'Payment tracking',
  'Outstanding / receivables',
  'Credit & debit notes',
  'Stock / inventory management',
  'Expense tracking',
  'GST reports',
  'Sales reports',
  'Customer statements',
  'Printable & PDF invoices',
  'Business dashboard',
  'User roles & permissions',
  'Backup & data security',
];

async function main() {
  await prisma.product.upsert({
    where: { slug: 'gst-billing' },
    update: {
      name: 'BCL GST Billing',
      category: 'Business Software',
      platform: 'Web (SaaS)',
      pricingModel: 'Subscription',
      licenseType: 'SaaS',
      description:
        'A simple and powerful GST billing and business management solution for small businesses, shops, service providers and growing enterprises. Create professional GST invoices, manage customers and products, track payments, and generate useful business reports from one place.',
      featuresJson: JSON.stringify(FEATURES),
      status: 'PUBLISHED',
      displayOrder: 4,
    },
    create: {
      name: 'BCL GST Billing',
      slug: 'gst-billing',
      code: 'GST',
      version: '1.0',
      category: 'Business Software',
      platform: 'Web (SaaS)',
      pricingModel: 'Subscription',
      licenseType: 'SaaS',
      description:
        'A simple and powerful GST billing and business management solution for small businesses, shops, service providers and growing enterprises. Create professional GST invoices, manage customers and products, track payments, and generate useful business reports from one place.',
      featuresJson: JSON.stringify(FEATURES),
      displayOrder: 4,
    },
  });

  await prisma.product.updateMany({
    where: { slug: 'custom-software' },
    data: {
      name: 'Business Solutions',
      category: 'Custom Software',
      featuresJson: JSON.stringify(['SaaS', 'CRM', 'APIs', 'Integrations']),
      displayOrder: 5,
    },
  });

  await prisma.product.updateMany({
    where: { slug: 'mobile-applications' },
    data: { displayOrder: 3 },
  });

  console.log('upserted gst-billing');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
