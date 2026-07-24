import Image from 'next/image';
import { absolutizeMediaUrl } from '@/lib/media-url';

export type LeadershipProfile = {
  name: string;
  role: string;
  tenure: string;
  imageSrc: string;
};

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect fill='%23e8eef6' width='120' height='120'/%3E%3Ccircle fill='%23c5d0de' cx='60' cy='46' r='22'/%3E%3Cpath fill='%23c5d0de' d='M20 112c8-28 28-42 40-42s32 14 40 42'/%3E%3C/svg%3E";

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function titleCaseName(name: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Parse imported dbc-profile-card markup into structured profiles. */
export function parseLeadershipProfiles(html: string): LeadershipProfile[] {
  const cards = html.match(/<div class="dbc-profile-card">[\s\S]*?<\/div>\s*<\/div>/gi) ?? [];
  return cards
    .map((card) => {
      const imageSrc =
        card.match(/src="([^"]+)"/i)?.[1] || card.match(/src='([^']+)'/i)?.[1] || PLACEHOLDER;
      const name = decodeEntities(card.match(/dbc-profile-name[^>]*>([^<]+)/i)?.[1] || '');
      const metas = [...card.matchAll(/dbc-profile-meta[^>]*>([^<]+)/gi)].map((match) =>
        decodeEntities(match[1] || ''),
      );
      const role = metas[0] || 'Former Principal';
      const tenure = metas[1] || '';
      if (!name) return null;
      const resolved = absolutizeMediaUrl(imageSrc) || imageSrc;
      const isPlaceholder =
        /placeholder|profile-placeholder|data:image\/svg/i.test(resolved) ||
        resolved.endsWith('.svg');
      return {
        name,
        role,
        tenure,
        imageSrc: isPlaceholder ? PLACEHOLDER : resolved,
      } satisfies LeadershipProfile;
    })
    .filter((item): item is LeadershipProfile => Boolean(item));
}

type Props = {
  title: string;
  subtitle?: string;
  profiles: LeadershipProfile[];
};

export function LeadershipProfiles({
  title,
  subtitle = 'Honoring the leaders who shaped our institution',
  profiles,
}: Props) {
  if (!profiles.length) return null;

  return (
    <section className="leadership-profiles" aria-labelledby="leadership-profiles-heading">
      <header className="leadership-profiles-head">
        <h2 id="leadership-profiles-heading">{title}</h2>
        <p>{subtitle}</p>
      </header>

      <ol className="leadership-profiles-grid">
        {profiles.map((profile, index) => (
          <li
            key={`${profile.name}-${profile.tenure}-${index}`}
            className="leadership-profile-card"
          >
            <div className="leadership-profile-photo">
              {profile.imageSrc.startsWith('data:') ? (
                // eslint-disable-next-line @next/next/no-img-element -- inline SVG placeholder
                <img src={profile.imageSrc} alt="" width={120} height={120} />
              ) : (
                <Image
                  src={profile.imageSrc}
                  alt={profile.name}
                  width={120}
                  height={120}
                  unoptimized
                />
              )}
            </div>
            <div className="leadership-profile-copy">
              <span className="leadership-profile-index" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{titleCaseName(profile.name)}</h3>
              <p className="leadership-profile-role">{profile.role}</p>
              {profile.tenure ? (
                <p className="leadership-profile-tenure">
                  <span>Tenure</span>
                  <strong>{profile.tenure}</strong>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
