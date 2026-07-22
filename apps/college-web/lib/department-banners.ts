const bannerBySlug: Record<string, string> = {
  botany:
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=80',
  chemistry:
    'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1400&q=80',
  commerce:
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80',
  'computer-science':
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80',
  economics:
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80',
  education:
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80',
  english:
    'https://images.unsplash.com/photo-1481627834876-b7833e8f6540?auto=format&fit=crop&w=1400&q=80',
  geography:
    'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1400&q=80',
  history:
    'https://images.unsplash.com/photo-1461360228754-6e81c08cd9a4?auto=format&fit=crop&w=1400&q=80',
  mathematics:
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1400&q=80',
  philosophy:
    'https://images.unsplash.com/photo-14565130808af8-7fd43ea9b320?auto=format&fit=crop&w=1400&q=80',
  physics:
    'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=1400&q=80',
  'political-science':
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1400&q=80',
  sociology:
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80',
  zoology:
    'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?auto=format&fit=crop&w=1400&q=80',
  garo: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80',
};

const bannerByCategory: Record<string, string> = {
  ARTS: 'https://images.unsplash.com/photo-1481627834876-b7833e8f6540?auto=format&fit=crop&w=1400&q=80',
  SCIENCE:
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=80',
  COMMERCE:
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80',
  PROFESSIONAL:
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80',
};

export function departmentBannerUrl(input: {
  bannerUrl?: string | null;
  slug: string;
  category: string;
}) {
  return (
    input.bannerUrl ||
    bannerBySlug[input.slug] ||
    bannerByCategory[input.category.toUpperCase()] ||
    bannerByCategory.ARTS
  );
}

export function shortDepartmentName(name: string) {
  return name.replace(/^Department of\s+/i, '');
}
