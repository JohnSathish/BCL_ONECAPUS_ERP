import { COMPANY } from '@/lib/company';

/** Feature highlights used on the /products grid (not the full capability list). */
export const PRODUCT_GRID_FEATURES: Record<string, string[]> = {
  'bcl-onecampus-erp': ['Student management', 'Admissions', 'Academics', 'Fees', 'Library'],
  'web-solutions': [
    'Corporate websites',
    'School websites',
    'College websites',
    'Web applications',
    'E-commerce',
  ],
  'mobile-applications': ['Android', 'iOS', 'Push notifications', 'Institution apps'],
  'gst-billing': ['GST invoicing', 'Inventory', 'Customers', 'Payments', 'GST reports'],
  'custom-software': ['SaaS', 'CRM', 'APIs', 'Integrations'],
};

export const GST_BILLING_URL = COMPANY.gstBilling.url;
