import type { PrivacySection } from '@/lib/school-web/privacy-policy-content';

export function SchoolPrivacyPolicyBody({ sections }: { sections: PrivacySection[] }) {
  return (
    <div className="sls-prose sls-prose-wide sls-privacy">
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
