'use client';

import { ExternalLink, FileUp, Library } from 'lucide-react';
import Link from 'next/link';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { QuestionBankSettingsPanel } from './question-bank-settings-panel';

function collegeSiteUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_COLLEGE_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://donboscocollege.ac.in';
  try {
    return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return path;
  }
}

export function QuestionBankView({ onMessage }: { onMessage: (message: string) => void }) {
  return (
    <div className="space-y-3">
      <CompactCard>
        <CompactCardHeader
          title="Where do the papers come from?"
          description="The website Question Bank lists papers from the ERP Question Paper Repository."
        />
        <CompactCardBody className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Upload papers once in <strong>Academics → Question Bank → Upload</strong>. Every upload
            is published immediately to the student dashboard and the mobile app. Papers with{' '}
            <strong>Show on website</strong> switched on also appear on the college website. Use the
            globe button in the repository to hide or show a paper on the website.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/admin/academics/question-bank/upload">
                <FileUp className="mr-1.5 h-4 w-4" aria-hidden /> Upload question paper
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/academics/question-bank">
                <Library className="mr-1.5 h-4 w-4" aria-hidden /> Open repository
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a
                href={collegeSiteUrl('/academics/question-bank')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> View public page
              </a>
            </Button>
          </div>
        </CompactCardBody>
      </CompactCard>
      <QuestionBankSettingsPanel onMessage={onMessage} />
    </div>
  );
}
