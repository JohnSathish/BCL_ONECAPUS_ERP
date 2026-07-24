import Image from 'next/image';
import { absolutizeMediaUrl } from '@/lib/media-url';

export type BiographyFeatureData = {
  imageSrc?: string;
  imageAlt?: string;
  caption?: string;
  paragraphs: string[];
  highlight?: string;
  facts?: Array<{ label: string; value: string }>;
};

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '));
}

/** Pull portrait + body copy from imported CMS HTML. */
export function parseBiographyHtml(html: string): BiographyFeatureData {
  const imageSrc = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || undefined;
  const imageAlt = html.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1] || undefined;
  const caption = stripTags(html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || '');
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1] || ''))
    .filter((text) => text.length > 0 && !/^https?:\/\//i.test(text));

  return {
    imageSrc: imageSrc ? absolutizeMediaUrl(imageSrc) || imageSrc : undefined,
    imageAlt: imageAlt ? decodeEntities(imageAlt) : undefined,
    caption: caption || undefined,
    paragraphs,
  };
}

type Props = {
  title: string;
  eyebrow?: string;
  data: BiographyFeatureData;
};

export function BiographyFeature({ title, eyebrow, data }: Props) {
  const lead = data.paragraphs[0];
  const rest = data.paragraphs.slice(1);

  return (
    <section className="biography-feature" aria-labelledby="biography-feature-heading">
      <header className="biography-feature-head">
        {eyebrow ? <p className="biography-feature-eyebrow">{eyebrow}</p> : null}
        <h2 id="biography-feature-heading">{title}</h2>
      </header>

      <div className={`biography-feature-layout${data.imageSrc ? '' : ' is-text-only'}`}>
        {data.imageSrc ? (
          <figure className="biography-feature-portrait">
            <div className="biography-feature-frame">
              <Image
                src={data.imageSrc}
                alt={data.imageAlt || title}
                width={420}
                height={520}
                unoptimized
                className="biography-feature-image"
              />
            </div>
            {data.caption ? <figcaption>{data.caption}</figcaption> : null}
          </figure>
        ) : null}

        <div className="biography-feature-copy">
          {lead ? <p className="biography-feature-lead">{lead}</p> : null}
          {data.highlight ? (
            <blockquote className="biography-feature-highlight">
              <p>{data.highlight}</p>
            </blockquote>
          ) : null}
          {rest.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
          {data.facts?.length ? (
            <dl className="biography-feature-facts">
              {data.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
