/**
 * Smoke check: Campus Competitions module wiring.
 * Run: npx ts-node -r tsconfig-paths/register scripts/smoke-campus-competitions.ts
 */
import {
  MEET_TYPES,
  categoriesForMeetType,
  pointsForPosition,
  metalForPosition,
} from '../src/modules/campus-competitions/domain/competition.constants';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(MEET_TYPES.length >= 5, 'meet types catalog missing');
assert(
  categoriesForMeetType('SPORTS_DAY').some((c) => c.code === '100M'),
  'sports categories',
);
assert(
  categoriesForMeetType('QUIZ').some((c) => c.groupCode === 'ACADEMIC'),
  'quiz categories',
);
assert(
  pointsForPosition(1, {
    firstPoints: 10,
    secondPoints: 7,
    thirdPoints: 5,
    participationPoints: 2,
  }) === 10,
  'first points',
);
assert(metalForPosition(2) === 'SILVER', 'silver medal');

console.log('smoke-campus-competitions: OK');
