import Image from 'next/image';
import Link from 'next/link';

type CourseCard = {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
};

const COURSES: CourseCard[] = [
  {
    id: 'cafa',
    title: 'Certificate Course in a Chik Folk Arts (CAFA)',
    excerpt:
      'This programme will introduction to the participants the concept of folklore, various types of folk Arts- music and dance…',
    href: '/short-term-courses/cafa',
    imageSrc: '/images/short-term-courses/cafa.webp',
    imageAlt: 'Certificate Course in a Chik Folk Arts',
  },
  {
    id: 'bccs',
    title: 'Basic Course on Computer Skills (BCCS)',
    excerpt:
      '🎓 Basic Course on Computer Skills (BCCS) 📌 Course Overview The Basic Course on Computer Skills is designed to provide…',
    href: '/short-term-courses/bccs',
    imageSrc: '/images/short-term-courses/bccs.webp',
    imageAlt: 'Basic Course on Computer Skills',
  },
  {
    id: 'elpc',
    title: 'English Language Proficiency Course (ELPC)',
    excerpt:
      '📘 English Language Proficiency Course (ELPC) Don Bosco College, Tura — enhance communication skills for academic and…',
    href: '/short-term-courses/elpc',
    imageSrc: '/images/short-term-courses/elpc.webp',
    imageAlt: 'English Language Proficiency Course',
  },
  {
    id: 'bcch',
    title: 'Basic Course in Computer Hardware (BCCH)',
    excerpt:
      '🎯 Course Objective To provide fundamental knowledge of computer hardware, enabling students to assemble, troubleshoot…',
    href: '/short-term-courses/bcch',
    imageSrc: '/images/short-term-courses/bcch.webp',
    imageAlt: 'Basic Course in Computer Hardware',
  },
  {
    id: 'bcte',
    title: 'BASIC COURSE IN TALLY (BCTE)',
    excerpt:
      '📊 Basic Course in Tally (Accounting Software) Don Bosco College, Tura — practical knowledge of computerized accounting…',
    href: '/short-term-courses/bcte',
    imageSrc: '/images/short-term-courses/bcte.webp',
    imageAlt: 'BASIC COURSE IN TALLY',
  },
];

export function ShortTermCoursesSection() {
  return (
    <section className="short-courses" aria-labelledby="short-courses-heading">
      <div className="shell short-courses-inner">
        <header className="short-courses-head">
          <h2 id="short-courses-heading">Short Term Courses</h2>
          <p>Skill-focused programmes designed for professional growth and lifelong learning.</p>
          <span className="short-courses-rule" aria-hidden />
        </header>

        <div className="short-courses-grid">
          {COURSES.map((course) => (
            <article key={course.id} className="short-courses-card">
              <div className="short-courses-media">
                <Image
                  src={course.imageSrc}
                  alt={course.imageAlt}
                  width={480}
                  height={360}
                  sizes="(max-width: 760px) 100vw, (max-width: 1100px) 33vw, 220px"
                />
              </div>
              <div className="short-courses-body">
                <h3>{course.title}</h3>
                <p>{course.excerpt}</p>
                <Link href={course.href} className="short-courses-btn">
                  Read More
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
