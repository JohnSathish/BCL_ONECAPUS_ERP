'use client';

import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { COMMAND_ITEMS } from '@/modules/dashboard/mock-data';

const STAFF_COMMANDS = [
  { label: 'Staff Dashboard', href: '/staff/dashboard' },
  { label: 'Take Attendance', href: '/staff/academic/attendance-entry' },
  { label: 'Open Timetable', href: '/staff/academic/timetable' },
  { label: 'Upload Lesson Plan', href: '/staff/academic/lesson-plans' },
  { label: 'Apply Leave', href: '/staff/leave' },
  { label: 'Download Payslip', href: '/staff/salary' },
  { label: 'View Subjects', href: '/staff/academic/subjects' },
  { label: 'My Profile', href: '/staff/profile' },
  { label: 'Portal Settings', href: '/staff/settings' },
  { label: 'Notifications', href: '/staff/notifications' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isStaffPortal = pathname.startsWith('/staff');

  const staffItems = useMemo(() => (isStaffPortal ? STAFF_COMMANDS : []), [isStaffPortal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-2 text-sm text-muted-foreground backdrop-blur transition hover:bg-muted/40 md:flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span>{isStaffPortal ? 'Search staff portal…' : 'Search campus…'}</span>
        <kbd className="ml-6 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Campus search and commands</DialogTitle>
          <Command className="rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Sparkles className="h-4 w-4 text-accent" />
              <Command.Input
                placeholder={
                  isStaffPortal
                    ? 'Search staff dashboard, attendance, leave…'
                    : 'Ask OneCampus AI or search students, courses, fees…'
                }
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
              {staffItems.length ? (
                <Command.Group heading="Staff Portal" className="px-2 py-2">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Staff Portal
                  </p>
                  {staffItems.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                      className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {COMMAND_ITEMS.map((group) => (
                <Command.Group key={group.group} heading={group.group} className="px-2 py-2">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.group}
                  </p>
                  {group.items.map((item) => (
                    <Command.Item
                      key={item}
                      value={item}
                      onSelect={() => setOpen(false)}
                      className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      {item}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
