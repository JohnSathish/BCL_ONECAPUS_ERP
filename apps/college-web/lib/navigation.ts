export const navigation = [
  {
    label: 'About Us',
    items: [
      ['Our Heritage', '/about/history'],
      ['Vision & Mission', '/about/vision-mission'],
      ['Principal’s Desk', '/about/principal'],
      ['Administration', '/about/administration'],
    ],
  },
  {
    label: 'Academics',
    items: [
      ['Departments', '/departments'],
      ['Programmes', '/academics/programmes'],
      ['Academic Calendar', '/academics/calendar'],
      ['Library', '/facilities/library'],
    ],
  },
  {
    label: 'Admission',
    items: [
      ['Apply Online', '/admission/apply'],
      ['Prospectus', '/admission/prospectus'],
      ['Eligibility', '/admission/eligibility'],
      ['Scholarships', '/admission/scholarships'],
    ],
  },
  {
    label: 'Campus Life',
    items: [
      ['Clubs & Societies', '/campus-life/clubs'],
      ['NSS & NCC', '/campus-life/nss-ncc'],
      ['Sports', '/campus-life/sports'],
      ['Alumni', '/campus-life/alumni'],
    ],
  },
  {
    label: 'Research',
    items: [
      ['Research Cell', '/research/cell'],
      ['Publications', '/research/publications'],
      ['Journals', '/research/journals'],
      ['Innovation', '/research/innovation'],
    ],
  },
] as const;
