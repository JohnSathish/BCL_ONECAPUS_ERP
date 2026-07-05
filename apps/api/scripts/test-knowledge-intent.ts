import { ConfigService } from '@nestjs/config';
import { HybridIntentResolver } from '../src/modules/ai-assistant/intent/hybrid-intent.resolver';

const resolver = new HybridIntentResolver(new ConfigService());

const questions = [
  'What is the credit for MDC-110?',
  'Show Semester 1 course details',
  'How many credits are required for FYUP?',
  'How much fee is pending for BA25-728?',
  'Show all Semester III students with pending fees',
  'Which MDC courses are available in Semester 1?',
  'Explain VAC-140',
];

for (const q of questions) {
  const intent = resolver.resolve(q);
  console.log(q, '=>', intent.action, intent.confidence);
}
