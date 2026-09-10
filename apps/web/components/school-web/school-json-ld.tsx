export function SchoolJsonLd({ data }: { data: unknown }) {
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean);
  return (
    <>
      {items.map((item, i) => (
        <script
          // CMS-controlled structured data; values are JSON.stringify-escaped.
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
