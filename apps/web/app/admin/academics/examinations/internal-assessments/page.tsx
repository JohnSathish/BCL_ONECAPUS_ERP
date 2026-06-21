import { redirect } from 'next/navigation';

export default function InternalAssessmentsRedirectPage() {
  redirect('/admin/academics/examinations/ia-exams');
}
