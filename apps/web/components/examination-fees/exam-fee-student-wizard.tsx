'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { api } from '@/services/api';
import {
  addExamBackPaper,
  examReceiptPdfUrl,
  removeExamBackPaper,
  startExamApplication,
  submitExamApplication,
} from '@/services/examination-fees';
import { cn } from '@/utils/cn';

function money(n: unknown) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STEPS = [
  { key: 'subjects', label: 'Current subjects', icon: GraduationCap },
  { key: 'back', label: 'Back papers', icon: Plus },
  { key: 'summary', label: 'Declare & submit', icon: FileText },
  { key: 'pay', label: 'Payment', icon: Wallet },
] as const;

export function ExamFeeStudentWizard({
  sessions,
  app,
  setApp,
  step,
  setStep,
  declaration,
  setDeclaration,
  paying,
  onPay,
}: {
  sessions: any[];
  app: any;
  setApp: (v: any) => void;
  step: number;
  setStep: (n: number) => void;
  declaration: boolean;
  setDeclaration: (v: boolean) => void;
  paying: boolean;
  onPay: (app: any) => Promise<void>;
}) {
  const active = sessions.find((s) => s.status === 'ACTIVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backForm, setBackForm] = useState({
    semesterNo: 1,
    subjectCode: '',
    subjectName: '',
    examPaperType: 'THEORY_ONLY' as 'THEORY_ONLY' | 'THEORY_PRACTICAL',
  });

  const progress = ((step + 1) / STEPS.length) * 100;
  const editable = ['DRAFT', 'CORRECTION_REQUESTED', 'AWAITING_PAYMENT', 'SUBMITTED'].includes(
    app?.status,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Semester examination application</CardTitle>
            <CardDescription>
              {active
                ? `${active.name} · ${active.semesterCycle} · ${active.academicYearLabel ?? ''}`
                : 'Waiting for an active examination fee session.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={app ? progress : 0} />
            <div className="flex flex-wrap gap-2">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const done = step > idx;
                const current = step === idx;
                return (
                  <div
                    key={s.key}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                      current && 'border-primary bg-primary text-primary-foreground',
                      done && !current && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                      !done && !current && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {idx + 1}. {s.label}
                  </div>
                );
              })}
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!app ? (
              <Button
                disabled={!active || busy}
                onClick={async () => {
                  if (!active) return;
                  setBusy(true);
                  setError(null);
                  try {
                    const created = await startExamApplication(active.id);
                    setApp(created);
                    setStep(0);
                  } catch (e: any) {
                    setError(e?.response?.data?.message ?? e?.message ?? 'Could not start');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {active ? `Apply for ${active.name}` : 'No active session'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm">
                  <span className="font-semibold">{app.applicationNo}</span>
                  <Badge variant="secondary">Sem {app.currentSemesterNo}</Badge>
                  <Badge variant="outline">{app.status}</Badge>
                  <span className="text-muted-foreground">{app.departmentName}</span>
                </div>

                {step === 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Registered subjects (auto-filled)</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(app.currentSubjects ?? []).map((s: any) => (
                        <Card key={s.id ?? s.subjectCode} className="shadow-none">
                          <CardContent className="space-y-1 p-4">
                            <div className="font-medium">
                              {s.subjectCode} · {s.subjectName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {s.examPaperType === 'THEORY_PRACTICAL'
                                ? 'Theory + Practical'
                                : 'Theory Only'}{' '}
                              · {money(s.amount)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {(app.currentSubjects ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                          No registered subjects found for your current semester.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => setStep(1)}>
                        Continue
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Back papers</h3>
                    <div className="space-y-2">
                      {(app.backPapers ?? []).map((p: any) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                        >
                          <span>
                            Sem {p.semesterNo} · {p.subjectCode} · {p.subjectName} ·{' '}
                            {money(p.amount)}
                          </span>
                          {editable ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const updated = await removeExamBackPaper(app.id, p.id);
                                setApp(updated);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {editable ? (
                      <Card className="shadow-none">
                        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                          <div>
                            <Label>Semester</Label>
                            <Input
                              type="number"
                              min={1}
                              value={backForm.semesterNo}
                              onChange={(e) =>
                                setBackForm((s) => ({
                                  ...s,
                                  semesterNo: Number(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Exam type</Label>
                            <select
                              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={backForm.examPaperType}
                              onChange={(e) =>
                                setBackForm((s) => ({
                                  ...s,
                                  examPaperType: e.target.value as any,
                                }))
                              }
                            >
                              <option value="THEORY_ONLY">Theory Only</option>
                              <option value="THEORY_PRACTICAL">Theory + Practical</option>
                            </select>
                          </div>
                          <div>
                            <Label>Subject code</Label>
                            <Input
                              value={backForm.subjectCode}
                              onChange={(e) =>
                                setBackForm((s) => ({
                                  ...s,
                                  subjectCode: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Subject name</Label>
                            <Input
                              value={backForm.subjectName}
                              onChange={(e) =>
                                setBackForm((s) => ({
                                  ...s,
                                  subjectName: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            className="sm:col-span-2 bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={async () => {
                              setError(null);
                              try {
                                const updated = await addExamBackPaper(app.id, backForm);
                                setApp(updated);
                                setBackForm((s) => ({
                                  ...s,
                                  subjectCode: '',
                                  subjectName: '',
                                }));
                              } catch (e: any) {
                                setError(
                                  e?.response?.data?.message ??
                                    e?.message ??
                                    'Could not add back paper',
                                );
                              }
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add back paper
                          </Button>
                        </CardContent>
                      </Card>
                    ) : null}
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setStep(0)}>
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      <Button onClick={() => setStep(2)}>
                        Continue
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-4">
                    <Card className="border-amber-200 bg-amber-50/80 shadow-none">
                      <CardContent className="space-y-3 p-4">
                        <p className="text-sm font-medium text-amber-950">
                          Review the fee summary, then confirm your declaration before payment.
                        </p>
                        <div
                          className={cn(
                            'flex items-start justify-between gap-3 rounded-xl border p-3',
                            declaration
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-amber-300 bg-white',
                          )}
                        >
                          <div className="text-sm text-amber-950">
                            I declare that all selected backlog papers are correct. I understand
                            that incorrect subject selection may lead to rejection by the
                            university.
                          </div>
                          <Switch checked={declaration} onCheckedChange={setDeclaration} />
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      {['DRAFT', 'CORRECTION_REQUESTED'].includes(app.status) ? (
                        <Button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                              const updated = await submitExamApplication(app.id, declaration);
                              setApp(updated);
                              setStep(3);
                            } catch (e: any) {
                              setError(e?.response?.data?.message ?? e?.message ?? 'Submit failed');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Submit application
                        </Button>
                      ) : (
                        <Button onClick={() => setStep(3)}>
                          {['PAID', 'MANUAL_PAID', 'UNDER_VERIFICATION', 'APPROVED'].includes(
                            String(app.status).toUpperCase(),
                          ) || (app.receipts?.length ?? 0) > 0
                            ? 'View payment & receipt'
                            : 'Proceed to payment'}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-3">
                    {app.status === 'AWAITING_PAYMENT' ? (
                      <Button
                        className="sticky bottom-4 w-full shadow-lg"
                        size="lg"
                        disabled={paying}
                        onClick={() => void onPay(app)}
                      >
                        {paying ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wallet className="mr-2 h-4 w-4" />
                        )}
                        {paying ? 'Opening payment…' : `Pay ${money(app.totalFee)} securely`}
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                          <div className="space-y-1">
                            <p className="font-semibold">
                              {['PAID', 'MANUAL_PAID', 'UNDER_VERIFICATION', 'APPROVED'].includes(
                                String(app.status).toUpperCase(),
                              )
                                ? 'Payment received'
                                : 'Application updated'}
                            </p>
                            <p>
                              Status: <strong>{String(app.status).replace(/_/g, ' ')}</strong>
                              {['UNDER_VERIFICATION', 'APPROVED'].includes(
                                String(app.status).toUpperCase(),
                              )
                                ? ' — your payment is being verified by the college.'
                                : null}
                            </p>
                            <p className="text-emerald-800">
                              Amount paid: <strong>{money(app.totalFee)}</strong>
                            </p>
                          </div>
                        </div>
                        {(app.receipts ?? [])[0] ? (
                          <Button
                            className="w-full bg-emerald-700 text-white hover:bg-emerald-800"
                            onClick={async () => {
                              const res = await api.get(examReceiptPdfUrl(app.receipts[0].id), {
                                responseType: 'blob',
                              });
                              window.open(URL.createObjectURL(res.data), '_blank');
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Download receipt PDF
                          </Button>
                        ) : (
                          <p className="text-xs text-emerald-800">
                            Receipt will appear here once it has been generated.
                          </p>
                        )}
                      </div>
                    )}
                    {app.status === 'AWAITING_PAYMENT' && (app.receipts ?? [])[0] ? (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const res = await api.get(examReceiptPdfUrl(app.receipts[0].id), {
                            responseType: 'blob',
                          });
                          window.open(URL.createObjectURL(res.data), '_blank');
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download / reprint receipt
                      </Button>
                    ) : null}
                    {app.status === 'AWAITING_PAYMENT' ? (
                      <Button variant="ghost" onClick={() => setStep(2)}>
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="text-base">Fee summary</CardTitle>
          <CardDescription>Updates as you add or remove papers</CardDescription>
        </CardHeader>
        <CardContent>
          {app ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current semester</dt>
                <dd className="font-medium">{money(app.currentSemesterFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Back papers</dt>
                <dd className="font-medium">{money(app.backPaperFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Processing</dt>
                <dd className="font-medium">{money(app.processingFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Late fee</dt>
                <dd className="font-medium">{money(app.lateFee)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{money(app.totalFee)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start an application to see live fee calculation.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
