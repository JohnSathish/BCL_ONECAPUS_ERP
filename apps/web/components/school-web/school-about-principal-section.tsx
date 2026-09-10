import { schoolWebPath } from '@/lib/school-web/paths';
import { SchoolMorningPrayerCard } from '@/components/school-web/school-morning-prayer-card';
import { schoolWeekdayPrayerKey } from '@/components/school-web/school-morning-prayers';
import {
  principalFromExtras,
  type SchoolPrincipalIdentity,
} from '@/components/school-web/school-principal-message';

export type SchoolHighlight = { n?: string; title: string; text?: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function ctaOf(value: unknown): { label?: string; href?: string } {
  const row = asRecord(value);
  return {
    label: row.label ? String(row.label) : undefined,
    href: row.href ? String(row.href) : undefined,
  };
}

export function aboutHighlights(
  about: Record<string, unknown>,
  pillars?: { items?: Array<{ n?: string; title: string; text?: string }> },
): SchoolHighlight[] {
  const fromAbout = Array.isArray(about.highlights)
    ? (about.highlights as Array<Record<string, unknown>>)
        .map((item) => ({
          n: item.n ? String(item.n) : undefined,
          title: String(item.title || ''),
          text: item.text ? String(item.text) : undefined,
        }))
        .filter((item) => item.title)
    : [];
  if (fromAbout.length) return fromAbout;
  return (pillars?.items ?? [])
    .map((item) => ({ n: item.n, title: item.title, text: item.text }))
    .filter((item) => item.title);
}

export function SchoolAboutPrincipalSection({
  about,
  extrasJson,
  motto,
  displayName,
  paragraphs,
  highlights,
  host,
}: {
  about: Record<string, unknown>;
  extrasJson: Record<string, unknown>;
  motto: string;
  displayName: string;
  paragraphs: string[];
  highlights: SchoolHighlight[];
  host?: string | null;
}) {
  const identity = principalFromExtras(extrasJson);
  const establishedYear = String(extrasJson.establishedYear || about.establishedYear || '').trim();
  const body = Array.isArray(about.body) ? about.body.map(String).filter(Boolean) : [];
  const cta = ctaOf(about.cta);
  const video = ctaOf(about.videoCta);
  const bandLine = String(about.bandLine || '').trim();
  const kicker = String(about.kicker || 'ABOUT OUR SCHOOL');
  const title = String(about.title || 'About the School');
  const { greeting, excerpts } = homepagePrincipalPreview(paragraphs, identity);
  const principalKicker = String(identity.kicker || 'MESSAGE FROM THE PRINCIPAL');
  const principalCta = String(identity.ctaLabel || "Read the Principal's Message");
  const principalHref = identity.ctaHref || '/principal';
  const schoolLine = identity.school || displayName;
  const campusPhoto = '/school-sis/about-students.webp';

  return (
    <section className="sls-about-pri" aria-labelledby="sls-about-heading">
      <div className="sls-about-pri-bg" aria-hidden />
      <div className="sls-wrap sls-about-pri-grid">
        <div className="sls-about-pri-side">
          <div className="sls-about-pri-copy sls-about-pri-anim">
            <div className="sls-about-pri-head">
              <div>
                <p className="sls-kicker sls-kicker-line">{kicker}</p>
                <h2 id="sls-about-heading">{title}</h2>
              </div>
            </div>
            {body.map((p) => (
              <p key={p} className="sls-muted">
                {p}
              </p>
            ))}
            {highlights.length ? (
              <ul className="sls-about-pri-highlights">
                {highlights.map((item, index) => (
                  <li key={`${item.n ?? index}-${item.title}`}>
                    <span className="sls-about-pri-icon" aria-hidden>
                      <HighlightMark index={index} />
                    </span>
                    {item.n ? <span className="sls-about-pri-num">{item.n}</span> : null}
                    <strong>{item.title}</strong>
                    {item.text ? <span>{item.text}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="sls-actions">
              {cta.label && cta.href ? (
                <a className="sls-btn sls-btn-gold" href={schoolWebPath(cta.href, host)}>
                  {cta.label} <span aria-hidden>→</span>
                </a>
              ) : null}
              {video.label && video.href ? (
                <a className="sls-btn sls-btn-text" href={schoolWebPath(video.href, host)}>
                  {video.label}
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="sls-about-pri-photos sls-about-pri-anim">
          <img
            className="is-main"
            src={campusPhoto}
            alt={`Students of ${displayName} gathered on the school steps`}
          />
          <p className="sls-about-pri-chip">
            <strong>Knowledge · Light</strong>
            <span>Since {establishedYear || '2009'}</span>
          </p>
        </div>
      </div>
      <div className="sls-about-pri-duo-band">
        <div className="sls-wrap sls-about-pri-duo">
          <aside
            className="sls-about-pri-card sls-about-pri-msg sls-about-pri-anim"
            aria-labelledby="sls-principal-kicker"
          >
            <div className="sls-about-pri-card-top">
              <PrincipalPortrait identity={identity} />
              <div>
                <p className="sls-kicker sls-kicker-lead" id="sls-principal-kicker">
                  {principalKicker}
                </p>
                {greeting ? <p className="sls-principal-greeting">{greeting}</p> : null}
              </div>
            </div>
            {excerpts.map((para) => (
              <p key={para.slice(0, 48)} className="sls-muted sls-about-pri-excerpt">
                {para}
              </p>
            ))}
            <div className="sls-about-pri-id">
              <p>
                {identity.name ? <strong>{identity.name}</strong> : null}
                {identity.title ? (
                  <>
                    <br />
                    {identity.title}
                  </>
                ) : null}
                {schoolLine ? (
                  <>
                    <br />
                    {schoolLine}
                  </>
                ) : null}
              </p>
              {identity.signatureUrl ? (
                <img className="sls-about-pri-sign" src={identity.signatureUrl} alt="" />
              ) : null}
            </div>
            <a
              className="sls-btn sls-btn-gold sls-about-pri-cta"
              href={schoolWebPath(principalHref, host)}
            >
              {principalCta} <span aria-hidden>→</span>
            </a>
          </aside>
          <SchoolMorningPrayerCard initialDay={schoolWeekdayPrayerKey()} />
        </div>
      </div>
      <div className="sls-about-pri-band">
        <div className="sls-wrap">
          <p>{motto.replace(/·/g, ' • ')}</p>
          {bandLine ? <span>{bandLine}</span> : null}
        </div>
      </div>
    </section>
  );
}

function homepagePrincipalPreview(paragraphs: string[], identity: SchoolPrincipalIdentity) {
  const greeting = String(identity.greeting || paragraphs[0] || '').trim();
  const body = paragraphs.filter((p) => p.trim() && p.trim() !== greeting);
  const first = body.find((p) => /immense pleasure/i.test(p)) || body[0] || '';
  const secondSource =
    body.find((p) => /Higher Secondary Section with Class XI/i.test(p)) || body[1] || '';
  const marker = 'Higher Secondary Section with Class XI.';
  const markAt = secondSource.indexOf(marker);
  const second =
    markAt >= 0 ? secondSource.slice(0, markAt + marker.length).trim() : secondSource.trim();
  const excerpts = [first, second].map((p) => p.trim()).filter(Boolean);
  if (excerpts.length) return { greeting, excerpts };
  const fallback = String(identity.excerpt || '').trim();
  return { greeting, excerpts: fallback ? [fallback] : [] };
}

function PrincipalPortrait({ identity }: { identity: SchoolPrincipalIdentity }) {
  if (!identity.photoUrl) return null;
  return (
    <figure className="sls-about-pri-photo sls-about-pri-photo-round">
      <img
        src={identity.photoUrl}
        alt={identity.photoAlt || identity.name || 'Principal'}
        width={320}
        height={400}
        style={identity.photoPosition ? { objectPosition: identity.photoPosition } : undefined}
      />
    </figure>
  );
}

function HighlightMark({ index }: { index: number }) {
  const i = index % 4;
  if (i === 0) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          fill="currentColor"
          d="M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 1-2-2V4zm2 2v14h8V7a1 1 0 0 0-1-1H8z"
        />
      </svg>
    );
  }
  if (i === 1) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          fill="currentColor"
          d="M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12zm-7 8a5.2 5.2 0 0 1 10.4 0zm8.2-8.6A3.2 3.2 0 1 0 16 7.2a3.2 3.2 0 0 0-2.8 4.2A4.7 4.7 0 0 1 21 20h-2.1a4.6 4.6 0 0 0-5.7-4.6z"
        />
      </svg>
    );
  }
  if (i === 2) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M11 3h2v7h7v2h-7v9h-2v-9H4v-2h7z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="currentColor"
        d="M12 3c2.4 3 4 5.2 4 7.4A4 4 0 0 1 8 10.4C8 8.2 9.6 6 12 3zm-1 11h2v7h-2z"
      />
    </svg>
  );
}
