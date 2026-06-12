'use client';

type ValidationIssuesPanelProps = {
  issues: { code: string; message: string }[];
};

export function ValidationIssuesPanel({ issues }: ValidationIssuesPanelProps) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
      {issues.map((i) => (
        <li key={`${i.code}-${i.message}`}>
          <span className="font-mono">{i.code}</span>: {i.message}
        </li>
      ))}
    </ul>
  );
}
