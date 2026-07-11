'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { downloadPaperVersion, fetchPaperVersions } from '@/services/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  paperId: string;
  paperLabel: string;
  onClose: () => void;
};

export function VersionsDrawer({ paperId, paperLabel, onClose }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const versionsQuery = useQuery({
    queryKey: ['question-bank', 'versions', paperId],
    queryFn: () => fetchPaperVersions(paperId),
    enabled: queryEnabled && Boolean(paperId),
  });

  const handleDownload = async (versionNo: number, fileName: string) => {
    const blob = await downloadPaperVersion(paperId, versionNo);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <History className="h-4 w-4" /> Version history
            </h3>
            <p className="text-sm text-muted-foreground">{paperLabel}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {versionsQuery.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(versionsQuery.error)}</p>
        ) : null}

        {!versionsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="space-y-2">
            {versionsQuery.data.map((v) => (
              <li key={v.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Version {v.versionNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                      {v.changeNote ? ` · ${v.changeNote}` : ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{v.fileName}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(v.versionNo, v.fileName)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
