export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  department: string;
  graduationYear: number;
  /** Optional current role / location line */
  status?: string;
  /** Real portrait URL when available; otherwise initials avatar is used */
  photoSrc?: string | null;
  photoAlt?: string;
  rating?: number;
};

/**
 * Seed voices until CMS Testimonials module is populated with approved
 * student/alumni stories and portraits. Prefer real photos via CMS.
 */
export const seedTestimonials: Testimonial[] = [
  {
    id: 'jemina-sangma',
    name: 'Jemina M. Sangma',
    department: 'B.Sc. Botany',
    graduationYear: 2021,
    status: 'Pursuing M.Sc. in Plant Ecology, NEHU, Shillong',
    rating: 5,
    quote:
      'Don Bosco College shaped the way I see science and service. Field visits around the Garo Hills taught me that ecology is not only a textbook chapter—it is the land our communities depend on. Lecturers made time for doubts after class, and the laboratory sessions gave me confidence I did not have in school. I still remember preparing herbarium sheets late into the evening with classmates who became lifelong friends. The college also pushed me to speak in seminars, which later helped me present my research proposal at NEHU. What stays with me most is the Salesian insistence that knowledge must serve others. That ethos guides my postgraduate work today. I am proud to say my foundation was laid at Bosco, Tura—not in a distant city, but here, among mentors who knew my name and believed in my potential.',
  },
  {
    id: 'anita-marak',
    name: 'Anita Ch. Marak',
    department: 'B.A. Education',
    graduationYear: 2018,
    status: 'Alumna · Secondary school educator, Tura',
    rating: 5,
    quote:
      'Don Bosco taught me to combine ambition with empathy. As a student of Education I watched my teachers model patience—especially with first-generation learners who needed encouragement as much as content. Micro-teaching practice, observation visits, and honest feedback from faculty prepared me for the classroom far better than theory alone. Campus clubs and morning assemblies quietly formed habits of punctuality and respect that I now expect of my own students. When I returned as an alumna for College Week, I realised the buildings had changed little, but the spirit felt the same: joyful learning with responsibility. The mentors here continue to shape every decision I make, from lesson planning to how I speak with parents. For prospective students wondering whether a college in Tura can open doors—my answer is yes, if you walk through them with sincerity.',
  },
  {
    id: 'ricky-sangma',
    name: 'Ricky R. Sangma',
    department: 'B.Com.',
    graduationYear: 2023,
    status: 'Student leader · Department of Commerce',
    rating: 5,
    quote:
      'The campus gave me room to question, create and lead. Commerce classes connected balance sheets to real businesses in Meghalaya, while soft-skill workshops made interviews less intimidating. I joined the debate club as a quiet fresher and left able to stand before a hall without fear. Teachers treated us as partners in learning; if we organised a seminar, they showed up and stayed till the last question. Hostel life taught me discipline and friendship across departments. Placement talks and alumni interactions showed paths I had never imagined from school. Most of all, Bosco insisted that character is not separate from career. That message—integrity in every transaction—is what I carry into my next chapter. I found a community that believed in my potential before I fully believed in myself.',
  },
  {
    id: 'larisa-ch-marak',
    name: 'Larisa Ch. Marak',
    department: 'B.Sc. Computer Science',
    graduationYear: 2020,
    status: 'Alumna · Software engineer, Guwahati',
    rating: 5,
    quote:
      'Computer Science at Don Bosco was rigorous without being cold. Labs ran late when projects demanded it, and faculty stayed to debug with us instead of sending us away with a textbook chapter. I learned to write cleaner code, present my work clearly, and collaborate across batches during hackathons and college festivals. Soft-skill sessions and placement mentoring made my first interview feel familiar rather than frightening. What I still carry is the habit of asking whether a solution is ethical as well as efficient—something our teachers modelled every week. Leaving Tura for Guwahati felt big, but Bosco had already taught me how to learn under pressure. I tell juniors that a strong foundation here travels with you, wherever the industry takes you next.',
  },
  {
    id: 'nangrak-momin',
    name: 'Nangrak Momin',
    department: 'B.A. Political Science',
    graduationYear: 2022,
    status: 'Alumnus · Civil services aspirant',
    rating: 5,
    quote:
      'Political Science at Bosco was never remote from the hills we live in. We debated governance, citizenship and local institutions with examples drawn from Meghalaya, not only from distant capitals. Library hours, peer study circles and patient guidance from faculty helped me build the reading habit that competitive exams demand. NSS camps reminded me that public service begins with listening to communities. I left with sharper analysis and a quieter confidence—the kind that comes from being trusted with responsibility on campus. The motto “In Pursuit of Excellence” is not a poster for me; it is a daily practice I first learned in these classrooms. I remain grateful to the Salesian community for an education that is both rigorous and human.',
  },
];

export function testimonialRoleLine(item: Testimonial): string {
  return `${item.department}, Class of ${item.graduationYear}`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
