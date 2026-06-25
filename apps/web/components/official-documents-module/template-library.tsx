'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { OfficialDocumentsShell } from '@/components/official-documents-module/official-documents-shell';
import { fetchOfficialDocumentTemplates } from '@/services/official-documents';

export function TemplateLibraryPage() {
  const templates = useQuery({
    queryKey: ['official-documents', 'templates'],
    queryFn: () => fetchOfficialDocumentTemplates(),
  });

  if (templates.isLoading) {
    return (
      <OfficialDocumentsShell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates…
        </p>
      </OfficialDocumentsShell>
    );
  }

  return (
    <OfficialDocumentsShell title="Document Templates">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Document Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-built templates for holiday notices, meetings, exams, and more.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(templates.data ?? []).map((tpl) => (
            <article key={tpl.id} className="rounded-2xl border border-border/60 bg-card/85 p-4">
              <div className="flex justify-between gap-2">
                <h2 className="font-semibold">{tpl.name}</h2>
                <span className="text-xs text-muted-foreground">{tpl.documentType}</span>
              </div>
              {tpl.salutation ? <p className="mt-2 text-xs font-medium">{tpl.salutation}</p> : null}
              <div
                className="prose prose-sm mt-2 max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: tpl.bodyHtml }}
              />
            </article>
          ))}
        </div>
      </div>
    </OfficialDocumentsShell>
  );
}
