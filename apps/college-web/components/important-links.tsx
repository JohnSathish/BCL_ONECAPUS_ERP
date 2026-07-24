import Link from 'next/link';
import { ArrowRight, Landmark, ShieldCheck } from 'lucide-react';

export type ImportantLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  tone: 'gold' | 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'teal' | 'indigo';
};

export const DEFAULT_IMPORTANT_LINKS: ImportantLink[] = [
  {
    id: 'ugc',
    label: 'UGC',
    description: 'University Grants Commission — quality standards for higher education.',
    href: 'https://www.ugc.gov.in/',
    tone: 'gold',
  },
  {
    id: 'nehu',
    label: 'NEHU',
    description: 'North-Eastern Hill University — our affiliating university.',
    href: 'https://www.nehu.ac.in/',
    tone: 'blue',
  },
  {
    id: 'aishe',
    label: 'AISHE',
    description: 'All India Survey on Higher Education — institutional data portal.',
    href: 'https://aishe.gov.in/',
    tone: 'green',
  },
  {
    id: 'nirf',
    label: 'NIRF',
    description: 'National Institutional Ranking Framework — ranking & outcomes.',
    href: 'https://www.nirfindia.org/',
    tone: 'purple',
  },
  {
    id: 'abc',
    label: 'Academic Bank of Credits',
    description: 'Credit accumulation, transfer and redemption for learners.',
    href: 'https://www.abc.gov.in/',
    tone: 'orange',
  },
  {
    id: 'nad',
    label: 'National Academic Depository',
    description: 'Secure digital repository for academic awards and certificates.',
    href: 'https://nad.digilocker.gov.in/',
    tone: 'pink',
  },
  {
    id: 'digilocker',
    label: 'DigiLocker',
    description: 'Government platform for digital documents and certificates.',
    href: 'https://www.digilocker.gov.in/',
    tone: 'teal',
  },
  {
    id: 'nsp',
    label: 'National Scholarships',
    description: 'Centralised portal for national scholarship schemes.',
    href: 'https://scholarships.gov.in/',
    tone: 'indigo',
  },
];

type Props = {
  title?: string;
  subtitle?: string;
  links?: ImportantLink[];
};

function LinkCard({ link }: { link: ImportantLink }) {
  const isExternal = /^https?:\/\//i.test(link.href);
  const className = `important-links-card tone-${link.tone}`;
  const body = (
    <>
      <span className="important-links-icon" aria-hidden>
        <Landmark />
      </span>
      <span className="important-links-copy">
        <strong>{link.label}</strong>
        <small>{link.description}</small>
      </span>
      <span className="important-links-arrow" aria-hidden>
        <ArrowRight />
      </span>
    </>
  );

  if (isExternal) {
    return (
      <a className={className} href={link.href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }

  return (
    <Link className={className} href={link.href}>
      {body}
    </Link>
  );
}

export function ImportantLinksSection({
  title = 'Important Links',
  subtitle = 'Quick access to essential academic and research portals',
  links = DEFAULT_IMPORTANT_LINKS,
}: Props) {
  return (
    <section className="important-links" aria-labelledby="important-links-heading">
      <div className="shell">
        <header className="important-links-head">
          <div className="important-links-ornament" aria-hidden>
            <span />
            <Landmark />
            <span />
          </div>
          <h2 id="important-links-heading">{title}</h2>
          <p>{subtitle}</p>
        </header>

        <div className="important-links-grid">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </div>

        <div className="important-links-trust">
          <ShieldCheck aria-hidden />
          <div>
            <strong>Trusted &amp; Secure Government Portals</strong>
            <span>Verified links to official websites</span>
          </div>
        </div>
      </div>
    </section>
  );
}
