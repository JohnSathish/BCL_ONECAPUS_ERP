export function schoolPeopleNav(pathname?: string | null) {
  const teachers = Boolean(pathname?.startsWith('/admin/school-sis/teachers'));
  return {
    teachers,
    base: teachers ? '/admin/school-sis/teachers' : '/admin/school-sis/staff',
    title: teachers ? 'Teachers' : 'Staff',
  };
}
