import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Award, BookOpen, GraduationCap, UserRound, Users } from 'lucide-react';
import { normalizePrincipalMessageHref, type HubLeadership } from '@/lib/information-hub';

type Props = {
  leadership: HubLeadership;
  highlights?: Array<{ label: string; value: string }>;
};

const defaultHighlights = [
  { icon: Award, label: 'Serving Since', value: '1987' },
  { icon: GraduationCap, label: 'Affiliated to', value: 'NEHU' },
  { icon: Users, label: 'Holistic Education', value: 'for Life' },
  { icon: BookOpen, label: 'Values | Knowledge | Service', value: 'The Don Bosco Way' },
] as const;

export function PrincipalMessageSection({ leadership, highlights }: Props) {
  const paragraphs = leadership.message
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
  const messageHref = normalizePrincipalMessageHref(leadership.messageHref);
  const barItems = highlights?.length
    ? highlights.map((item, index) => ({
        icon: defaultHighlights[index % defaultHighlights.length].icon,
        label: item.label,
        value: item.value,
      }))
    : defaultHighlights;

  return (
    <article
      className="principal-feature principal-feature-column"
      aria-labelledby="principal-feature-heading"
    >
      <div className="principal-feature-panel">
        <div className="principal-feature-media">
          <div className="principal-feature-photo">
            <Image
              src={leadership.portraitSrc}
              alt={leadership.portraitAlt}
              fill
              sizes="(max-width: 1100px) 90vw, 320px"
              priority
            />
          </div>
          <div className="principal-feature-nameplate">
            <strong>{leadership.name}</strong>
            <span>{leadership.role}</span>
          </div>
        </div>

        <div className="principal-feature-copy">
          <div className="principal-feature-watermark" aria-hidden>
            <Image src="/images/st-john-bosco.png" alt="" fill sizes="160px" />
          </div>

          <header className="principal-feature-head">
            <span className="principal-feature-icon" aria-hidden>
              <UserRound />
            </span>
            <div>
              <h2 id="principal-feature-heading">Principal&apos;s Message</h2>
              <span className="principal-feature-rule" aria-hidden />
            </div>
          </header>

          <div className="principal-feature-body">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>

          <div className="principal-feature-actions">
            <Link className="principal-feature-cta" href={messageHref}>
              Read full message <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      <div className="principal-feature-bar">
        <div className="principal-feature-bar-grid">
          {barItems.map(({ icon: Icon, label, value }) => (
            <div className="principal-feature-bar-item" key={label}>
              <span aria-hidden>
                <Icon />
              </span>
              <p>
                <small>{label}</small>
                <strong>{value}</strong>
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
