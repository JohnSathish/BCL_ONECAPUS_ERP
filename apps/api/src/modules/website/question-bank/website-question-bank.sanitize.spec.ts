import {
  paperIdFromSlug,
  questionPaperSlug,
  safeDownloadFileName,
  sanitizePlainText,
  sanitizeSubjectCode,
  slugifyQuestionPaper,
} from './website-question-bank.sanitize';

const ID = '3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b';

describe('website question bank sanitizers', () => {
  it('strips markup and control characters from plain text', () => {
    expect(
      sanitizePlainText('<b>Human</b>\u0000 <script>x</script> Geography', 100),
    ).toBe('Human x Geography');
    expect(sanitizePlainText('a'.repeat(50), 10)).toHaveLength(10);
  });

  it('normalizes subject codes', () => {
    expect(sanitizeSubjectCode(' geog-305<script> ')).toBe('GEOG-305');
    expect(sanitizeSubjectCode('eng 301 & "x"')).toBe('ENG 301 X');
  });

  it('builds URL-safe slugs and file names', () => {
    expect(slugifyQuestionPaper('GEOG-305: Human Geography 2026')).toBe(
      'geog-305-human-geography-2026',
    );
    expect(slugifyQuestionPaper('***')).toBe('question-paper');
    expect(safeDownloadFileName('GEOG-305 Human "Geography" 2026')).toBe(
      'GEOG-305-Human-Geography-2026.pdf',
    );
  });

  it('round-trips the paper id through its public slug', () => {
    const slug = questionPaperSlug({
      id: ID,
      paperCode: 'ENG-101',
      paperName: 'English Literature',
      examYear: 2025,
    });
    expect(slug).toBe(`eng-101-english-literature-2025-${ID}`);
    expect(paperIdFromSlug(slug)).toBe(ID);
  });

  it('rejects slugs without a trailing paper id', () => {
    expect(paperIdFromSlug('eng-101-english-literature-2025')).toBeNull();
  });
});
