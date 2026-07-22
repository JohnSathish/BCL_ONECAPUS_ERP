import { sanitizeWebsiteHtml } from './website-html-sanitizer';

describe('sanitizeWebsiteHtml', () => {
  it('removes executable markup and unsafe URLs', () => {
    const result = sanitizeWebsiteHtml(`
      <script>alert(1)</script>
      <p style="color:red" onclick="alert(1)">Safe</p>
      <a href="javascript:alert(1)" target="_blank">bad link</a>
      <img src="data:image/svg+xml,bad" onerror="alert(1)">
    `);

    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('data:');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('keeps supported content and safe links', () => {
    const result = sanitizeWebsiteHtml(
      '<h2>Heading</h2><a href="https://example.edu">Visit</a><img src="/uploads/photo.webp" alt="Campus">',
    );

    expect(result).toContain('<h2>Heading</h2>');
    expect(result).toContain('href="https://example.edu"');
    expect(result).toContain('src="/uploads/photo.webp"');
    expect(result).toContain('loading="lazy"');
  });
});
