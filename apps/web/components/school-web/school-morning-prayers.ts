export const MORNING_PRAYER_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

export type MorningPrayerDay = (typeof MORNING_PRAYER_DAYS)[number];

export type MorningPrayer = {
  day: MorningPrayerDay;
  label: string;
  title: string;
  body: string;
  close: string;
};

export const MORNING_PRAYERS: MorningPrayer[] = [
  {
    day: 'monday',
    label: 'Monday',
    title: 'Monday Prayer',
    body: 'God our loving Father, be with us today. May we experience your fatherly care over us. Guard us from every harm. May we act in your strength, think in your wisdom, speak in your truth and live in your love. Amen.',
    close: 'Our Father …',
  },
  {
    day: 'tuesday',
    label: 'Tuesday',
    title: 'Tuesday Prayer',
    body: 'O God, come as the wisdom to these your children. We are plants in your garden. Let your rain fall upon us. Let the sun of reality shine upon us with the love. Let your breeze refresh us in order that we may be trained, grow and develop, and appear in the utmost beauty. Amen.',
    close: 'Our Father …',
  },
  {
    day: 'wednesday',
    label: 'Wednesday',
    title: 'Wednesday Prayer',
    body: 'O God, the eternal Father, purify my heart. Take away all evil desire from me and fill it with your love. You are my guide and wisdom. Help me to learn my lessons well today. Amen.',
    close: 'Our Father …',
  },
  {
    day: 'thursday',
    label: 'Thursday',
    title: 'Thursday Prayer',
    body: 'Almighty loving Father, help us today to be obedient and loving. Help us to realise that there is no wisdom without study, no achievement without work, no love without self-sacrifice, and no skill of body and mind without discipline. Teach us to be a loyal friend to all. Amen.',
    close: 'Our Father …',
  },
  {
    day: 'friday',
    label: 'Friday',
    title: 'Friday Prayer',
    body: 'Dear Jesus, we thank you for sharing our human condition. Thank you for dying on the cross to liberate us from all the bondages. Give us courage like you, to forgive even our enemies and to wish them good. Help us to love everyone as you loved. Amen.',
    close: 'Our Father …',
  },
];

export function schoolWeekdayPrayerKey(date = new Date()): MorningPrayerDay {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  })
    .format(date)
    .toLowerCase();
  if (
    weekday === 'tuesday' ||
    weekday === 'wednesday' ||
    weekday === 'thursday' ||
    weekday === 'friday'
  ) {
    return weekday;
  }
  return 'monday';
}
