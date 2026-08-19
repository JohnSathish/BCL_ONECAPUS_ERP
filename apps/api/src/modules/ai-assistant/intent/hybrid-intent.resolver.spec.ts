import { ConfigService } from '@nestjs/config';
import { HybridIntentResolver } from './hybrid-intent.resolver';

describe('HybridIntentResolver paper enrolment', () => {
  const resolver = new HybridIntentResolver({
    get: () => undefined,
  } as unknown as ConfigService);

  it('routes VTC opted-student questions to live ERP, not Knowledge Base', () => {
    const intent = resolver.resolve(
      'which students opted VTC – Desktop Publishing – I(VTC-243.2) list out the students roll number and names',
    );
    expect(intent.action).toBe('list_paper_students');
    expect(intent.searchQuery?.toUpperCase()).toContain('VTC-243');
  });

  it('routes the comma phrasing from the assistant screenshot to live ERP', () => {
    const intent = resolver.resolve(
      'which students, opted VTC – Desktop Publishing – I(VTC-243.2) list out the students roll number and names',
    );
    expect(intent.action).toBe('list_paper_students');
    expect(intent.searchQuery?.toUpperCase()).toContain('VTC-243');
  });

  it('still sends credit questions to the Knowledge Base', () => {
    const intent = resolver.resolve('What is the credit for MDC-110?');
    expect(intent.action).toBe('knowledge_query');
  });
});
