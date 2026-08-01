'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { colorForType, formatDisplayDate } from '@/lib/academic-calendar-ui';
import type { AcademicCalendarEvent } from '@/services/academic-calendar';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AcademicCalendarEvent | null;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpload: (file: File) => void;
};

export function AcademicCalendarEventDetailsDialog({
  open,
  onOpenChange,
  event,
  canEdit,
  onEdit,
  onDelete,
  onDuplicate,
  onUpload,
}: Props) {
  if (!event) return null;
  const color = colorForType(event.type, event.color);
  const readOnly = Boolean(event.readOnly || event.sourceModule);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-[#E5E7EB] p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {event.icon ? <span>{event.icon}</span> : null}
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {event.description ? (
            <p className="whitespace-pre-wrap text-muted-foreground">{event.description}</p>
          ) : null}
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{event.type.replaceAll('_', ' ')}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd>
              {formatDisplayDate(event.startDate)}
              {event.endDate !== event.startDate ? ` → ${formatDisplayDate(event.endDate)}` : ''}
            </dd>
            <dt className="text-muted-foreground">Time</dt>
            <dd>
              {event.isAllDay ? 'All day' : `${event.startTime ?? '—'} – ${event.endTime ?? '—'}`}
            </dd>
            <dt className="text-muted-foreground">Venue</dt>
            <dd>{event.venue || '—'}</dd>
            <dt className="text-muted-foreground">Organizer</dt>
            <dd>{event.organizerName || '—'}</dd>
            <dt className="text-muted-foreground">Visibility</dt>
            <dd>{event.visibility}</dd>
            {event.sourceModule ? (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd>Managed by {event.sourceModule}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Created</dt>
            <dd>{event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{event.updatedAt ? new Date(event.updatedAt).toLocaleString() : '—'}</dd>
          </dl>

          {(event.attachmentUrls?.length ?? 0) > 0 ? (
            <div>
              <p className="mb-1 font-medium">Attachments</p>
              <ul className="space-y-1">
                {event.attachmentUrls!.map((a) => (
                  <li key={a.url}>
                    <a
                      className="text-primary underline"
                      href={resolveUploadAssetUrl(a.url) ?? a.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canEdit && !readOnly ? (
            <div>
              <LabelFile onUpload={onUpload} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.print();
            }}
          >
            Print
          </Button>
          {canEdit && !readOnly ? (
            <>
              <Button type="button" variant="secondary" onClick={onDuplicate}>
                Duplicate
              </Button>
              <Button type="button" onClick={onEdit}>
                Edit
              </Button>
              <Button type="button" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LabelFile({ onUpload }: { onUpload: (file: File) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
      Upload attachment (PDF / image)
    </label>
  );
}
