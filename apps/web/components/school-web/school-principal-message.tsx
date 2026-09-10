import { schoolWebPath } from '@/lib/school-web/paths';

export type SchoolPrincipalIdentity = {
  name?: string;
  title?: string;
  school?: string;
  photoUrl?: string;
  photoAlt?: string;
  photoPosition?: string;
  signatureUrl?: string;
  greeting?: string;
  excerpt?: string;
  kicker?: string;
  heading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  quote?: string;
  quoteAttribution?: string;
};

export function principalFromExtras(
  extrasJson: Record<string, unknown> | undefined,
): SchoolPrincipalIdentity {
  const raw = extrasJson?.principal;
  if (!raw || typeof raw !== 'object') return {};
  return raw as SchoolPrincipalIdentity;
}

function splitMessage(paragraphs: string[]) {
  if (paragraphs.length < 5) {
    return { greeting: paragraphs[0] ?? '', body: paragraphs.slice(1), signoff: [] as string[] };
  }
  return {
    greeting: paragraphs[0] ?? '',
    body: paragraphs.slice(1, -4),
    signoff: paragraphs.slice(-4),
  };
}

export function SchoolPrincipalMessage({
  identity,
  paragraphs,
  excerptOnly = false,
  host,
}: {
  identity: SchoolPrincipalIdentity;
  paragraphs: string[];
  excerptOnly?: boolean;
  host?: string | null;
}) {
  const name = identity.name || '';
  const title = identity.title || '';
  const school = identity.school || '';
  const { greeting, body, signoff } = splitMessage(paragraphs);
  const excerpt = identity.excerpt || body[0] || '';

  return (
    <div className={`sls-principal${excerptOnly ? ' sls-principal--card' : ''}`}>
      {identity.photoUrl ? (
        <figure className="sls-principal-photo sls-about-pri-photo">
          <span className="sls-about-pri-photo-deco" aria-hidden />
          <img
            src={identity.photoUrl}
            alt={identity.photoAlt || name || 'Principal'}
            width={480}
            height={600}
            style={identity.photoPosition ? { objectPosition: identity.photoPosition } : undefined}
          />
        </figure>
      ) : null}
      <div>
        <p className="sls-kicker sls-kicker-line">
          {identity.kicker || 'MESSAGE FROM THE PRINCIPAL'}
        </p>
        {excerptOnly ? <h3>{identity.heading || 'Message of the Principal'}</h3> : null}
        {greeting ? <p className="sls-principal-greeting">{greeting}</p> : null}
        {excerptOnly ? (
          <p className="sls-muted">{excerpt}</p>
        ) : (
          body.map((p) => (
            <p key={p} className="sls-muted">
              {p}
            </p>
          ))
        )}
        {excerptOnly ? (
          <>
            <p className="sls-principal-sign">
              {name ? <strong>{name}</strong> : null}
              {title ? (
                <>
                  <br />
                  {title}
                </>
              ) : null}
              {school ? (
                <>
                  <br />
                  {school}
                </>
              ) : null}
            </p>
            {identity.signatureUrl ? (
              <img className="sls-about-pri-sign" src={identity.signatureUrl} alt="" />
            ) : null}
            <a
              className="sls-btn sls-btn-navy"
              href={schoolWebPath(identity.ctaHref || '/principal', host)}
              style={{ marginTop: 12 }}
            >
              {identity.ctaLabel || "Read the Principal's Message"} <span aria-hidden>→</span>
            </a>
          </>
        ) : (
          <p className="sls-principal-sign">
            {signoff.map((line, i) => (
              <span key={line}>
                {i === 1 ? <strong>{line}</strong> : line}
                {i < signoff.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
