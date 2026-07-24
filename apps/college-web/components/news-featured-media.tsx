import Image from 'next/image';
import { newsCategoryIcon, hasNewsFeaturedImage, newsPlaceholderTone } from '@/lib/news-media';

type Props = {
  image?: string | null;
  title: string;
  slug: string;
  category: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export function NewsFeaturedMedia({
  image,
  title,
  slug,
  category,
  className,
  sizes = '(max-width: 760px) 100vw, 360px',
  priority = false,
}: Props) {
  const hasImage = hasNewsFeaturedImage(image);
  const tone = newsPlaceholderTone(slug || title);
  const Icon = newsCategoryIcon(category);
  const classes = ['news-featured-media', className].filter(Boolean).join(' ');

  if (hasImage && image) {
    return (
      <div className={classes}>
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={image.startsWith('/uploads/') || image.startsWith('http')}
        />
      </div>
    );
  }

  return (
    <div className={`${classes} news-featured-placeholder tone-${tone}`} aria-hidden>
      <Icon className="news-featured-placeholder-icon" />
    </div>
  );
}
