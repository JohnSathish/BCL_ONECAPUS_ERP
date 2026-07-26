'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CareersFileDropzone } from '@/components/careers-portal/careers-file-dropzone';
import {
  CareersTurnstile,
  isCareersTurnstileEnabled,
} from '@/components/careers-portal/careers-turnstile';
import { CAREERS_WIZARD_STEPS } from '@/lib/careers-portal/constants';
import {
  submitCareersApplication,
  uploadCareersFile,
  type CareersJob,
} from '@/services/careers-portal';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type EducationRow = {
  qualification: string;
  university: string;
  year: string;
  score: string;
  specialization: string;
};

type ExperienceRow = {
  institution: string;
  designation: string;
  fromDate: string;
  toDate: string;
  experience: string;
};

type DraftData = {
  step: number;
  personal: {
    fullName: string;
    fatherName: string;
    motherName: string;
    gender: string;
    dateOfBirth: string;
    maritalStatus: string;
    nationality: string;
  };
  contact: {
    mobile: string;
    whatsapp: string;
    email: string;
    permanentAddress: string;
    correspondenceAddress: string;
  };
  education: EducationRow[];
  experience: ExperienceRow[];
  research: {
    researchArea: string;
    publicationsCount: string;
    booksPublished: string;
    conferencePapers: string;
    researchProjects: string;
    googleScholar: string;
    orcid: string;
    scopusId: string;
    netQualified: string;
    setQualified: string;
    phdDetails: string;
  };
  declaration: boolean;
  website: string;
};

/** Futuristic compact controls shared across wizard steps */
const controlClass =
  'h-10 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-slate-400 focus:border-cyan-400/70 focus:bg-white focus:ring-2 focus:ring-cyan-400/25';

const selectClass = `${controlClass} appearance-none pr-8`;

const emptyEducation = (): EducationRow => ({
  qualification: '',
  university: '',
  year: '',
  score: '',
  specialization: '',
});

const emptyExperience = (): ExperienceRow => ({
  institution: '',
  designation: '',
  fromDate: '',
  toDate: '',
  experience: '',
});

function defaultDraft(): DraftData {
  return {
    step: 0,
    personal: {
      fullName: '',
      fatherName: '',
      motherName: '',
      gender: '',
      dateOfBirth: '',
      maritalStatus: '',
      nationality: 'Indian',
    },
    contact: {
      mobile: '',
      whatsapp: '',
      email: '',
      permanentAddress: '',
      correspondenceAddress: '',
    },
    education: [emptyEducation()],
    experience: [emptyExperience()],
    research: {
      researchArea: '',
      publicationsCount: '',
      booksPublished: '',
      conferencePapers: '',
      researchProjects: '',
      googleScholar: '',
      orcid: '',
      scopusId: '',
      netQualified: '',
      setQualified: '',
      phdDetails: '',
    },
    declaration: false,
    website: '',
  };
}

export function CareersApplicationWizard({ job }: { job: CareersJob }) {
  const router = useRouter();
  const storageKey = `careers-draft-${job.id}`;
  const turnstileRequired = isCareersTurnstileEnabled();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftData>(defaultDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedHint, setSavedHint] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [ugCert, setUgCert] = useState<File | null>(null);
  const [pgCert, setPgCert] = useState<File | null>(null);
  const [optionalDocs, setOptionalDocs] = useState<File[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftData;
        setDraft({ ...defaultDraft(), ...parsed, step: parsed.step ?? 0 });
        setStep(parsed.step ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const progress = useMemo(
    () => Math.round(((step + 1) / CAREERS_WIZARD_STEPS.length) * 100),
    [step],
  );

  const saveDraft = useCallback(() => {
    const payload = { ...draft, step };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    setSavedHint('Draft saved on this device');
    setTimeout(() => setSavedHint(''), 2500);
  }, [draft, step, storageKey]);

  const highestQualification =
    draft.education.filter((e) => e.qualification.trim()).slice(-1)[0]?.qualification ?? '';

  const totalExperienceYears = draft.experience.reduce(
    (sum, e) => sum + (Number(e.experience) || 0),
    0,
  );

  async function submitApplication() {
    setLoading(true);
    setError('');
    try {
      if (turnstileRequired && !turnstileToken) {
        setError('Please complete the security check.');
        return;
      }
      if (!resume) {
        setError('Resume (PDF) is required.');
        return;
      }
      if (!draft.declaration) {
        setError('Please accept the declaration.');
        return;
      }
      const vacancyId = job.id?.trim();
      if (!vacancyId || !/^[0-9a-f-]{36}$/i.test(vacancyId)) {
        setError('This vacancy could not be loaded. Please refresh the page and try again.');
        return;
      }

      const result = await submitCareersApplication({
        vacancyId,
        fullName: draft.personal.fullName.trim(),
        fatherName: draft.personal.fatherName || undefined,
        email: draft.contact.email.trim(),
        mobile: draft.contact.mobile.trim(),
        dateOfBirth: draft.personal.dateOfBirth || undefined,
        addressJson: {
          line1: draft.contact.permanentAddress,
          city: '',
          correspondence: draft.contact.correspondenceAddress,
        },
        qualification: highestQualification,
        experienceYears: totalExperienceYears || undefined,
        applicationDetailsJson: {
          personal: draft.personal,
          contact: draft.contact,
          education: draft.education,
          experience: draft.experience,
          research: draft.research,
          declarationAccepted: draft.declaration,
        },
        website: draft.website || undefined,
        turnstileToken: turnstileToken || undefined,
      });

      await uploadCareersFile(result.applicationId, 'resume', resume);
      if (photo) await uploadCareersFile(result.applicationId, 'photo', photo);
      if (ugCert) await uploadCareersFile(result.applicationId, 'certificate', ugCert);
      if (pgCert) await uploadCareersFile(result.applicationId, 'certificate', pgCert);
      for (const doc of optionalDocs) {
        await uploadCareersFile(result.applicationId, 'certificate', doc);
      }

      localStorage.removeItem(storageKey);
      router.push(
        `/careers-portal/application-status?no=${encodeURIComponent(result.applicationNo)}&mobile=${encodeURIComponent(draft.contact.mobile)}&submitted=1`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit application'));
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    if (step === 0 && !draft.personal.fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (step === 1 && (!draft.contact.mobile.trim() || !draft.contact.email.trim())) {
      setError('Mobile and email are required.');
      return;
    }
    if (step === 5 && !resume) {
      setError('Please upload your resume (PDF) before continuing.');
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, CAREERS_WIZARD_STEPS.length - 1));
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-b from-white via-white to-slate-50 text-slate-900 shadow-[0_24px_80px_rgba(8,24,48,0.45),0_0_0_1px_rgba(34,211,238,0.08)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 top-24 h-28 w-28 rounded-full bg-[#c8102e]/10 blur-3xl"
      />

      <div className="relative border-b border-slate-200/80 bg-gradient-to-r from-[#0b1f4a] via-[#123058] to-[#0b1f4a] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
              Online Application
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">
              {job.title}
            </h2>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-cyan-100 backdrop-blur">
            {progress}% complete
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
          {CAREERS_WIZARD_STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={label}
                type="button"
                title={label}
                onClick={() => {
                  if (i <= step) setStep(i);
                }}
                className={cn(
                  'h-1.5 min-w-[2rem] flex-1 rounded-full transition-all duration-300',
                  active &&
                    'bg-gradient-to-r from-cyan-300 to-[#f4b400] shadow-[0_0_12px_rgba(34,211,238,0.55)]',
                  done && !active && 'bg-cyan-400/70',
                  !done && !active && 'bg-white/20',
                )}
                aria-label={`Step ${i + 1}: ${label}`}
                aria-current={active ? 'step' : undefined}
              />
            );
          })}
        </div>
        <p className="mt-2.5 text-xs text-slate-300">
          Step {step + 1} of {CAREERS_WIZARD_STEPS.length}
          <span className="mx-1.5 text-white/30">·</span>
          <span className="font-medium text-white">{CAREERS_WIZARD_STEPS[step]}</span>
        </p>
      </div>

      <div className="relative max-h-[min(68vh,720px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:h-10 [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:rounded-xl [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:border-slate-200/90 [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:bg-slate-50/80 [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:focus-visible:border-cyan-400/70 [&_input:not([type=checkbox]):not([type=file]):not([type=hidden])]:focus-visible:ring-cyan-400/25 [&_select]:h-10 [&_select]:rounded-xl [&_select]:border-slate-200/90 [&_select]:bg-slate-50/80 [&_select]:px-3 [&_select]:text-sm [&_select]:focus:border-cyan-400/70 [&_select]:focus:ring-2 [&_select]:focus:ring-cyan-400/25 [&_textarea]:rounded-xl [&_textarea]:border-slate-200/90 [&_textarea]:bg-slate-50/80">
        {error ? (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {savedHint ? (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {savedHint}
          </p>
        ) : null}

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full Name *" className="sm:col-span-2">
              <Input
                className={controlClass}
                value={draft.personal.fullName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, personal: { ...d.personal, fullName: e.target.value } }))
                }
              />
            </Field>
            <Field label="Father's Name">
              <Input
                className={controlClass}
                value={draft.personal.fatherName}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    personal: { ...d.personal, fatherName: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Mother's Name">
              <Input
                className={controlClass}
                value={draft.personal.motherName}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    personal: { ...d.personal, motherName: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Gender">
              <select
                className={selectClass}
                value={draft.personal.gender}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, personal: { ...d.personal, gender: e.target.value } }))
                }
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                className={controlClass}
                value={draft.personal.dateOfBirth}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    personal: { ...d.personal, dateOfBirth: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Marital Status">
              <select
                className={selectClass}
                value={draft.personal.maritalStatus}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    personal: { ...d.personal, maritalStatus: e.target.value },
                  }))
                }
              >
                <option value="">Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
              </select>
            </Field>
            <Field label="Nationality">
              <Input
                className={controlClass}
                value={draft.personal.nationality}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    personal: { ...d.personal, nationality: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile Number *">
              <Input
                className={controlClass}
                value={draft.contact.mobile}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, contact: { ...d.contact, mobile: e.target.value } }))
                }
              />
            </Field>
            <Field label="WhatsApp Number">
              <Input
                value={draft.contact.whatsapp}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, contact: { ...d.contact, whatsapp: e.target.value } }))
                }
              />
            </Field>
            <Field label="Email Address *" className="sm:col-span-2">
              <Input
                type="email"
                value={draft.contact.email}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, contact: { ...d.contact, email: e.target.value } }))
                }
              />
            </Field>
            <Field label="Permanent Address" className="sm:col-span-2">
              <textarea
                className="min-h-20 w-full rounded-md border p-2 text-sm"
                value={draft.contact.permanentAddress}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    contact: { ...d.contact, permanentAddress: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Correspondence Address" className="sm:col-span-2">
              <textarea
                className="min-h-20 w-full rounded-md border p-2 text-sm"
                value={draft.contact.correspondenceAddress}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    contact: { ...d.contact, correspondenceAddress: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {draft.education.map((row, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Qualification">
                    <Input
                      placeholder="e.g. M.A., Ph.D."
                      value={row.qualification}
                      onChange={(e) => {
                        const education = [...draft.education];
                        education[i] = { ...row, qualification: e.target.value };
                        setDraft((d) => ({ ...d, education }));
                      }}
                    />
                  </Field>
                  <Field label="University / Board">
                    <Input
                      value={row.university}
                      onChange={(e) => {
                        const education = [...draft.education];
                        education[i] = { ...row, university: e.target.value };
                        setDraft((d) => ({ ...d, education }));
                      }}
                    />
                  </Field>
                  <Field label="Year">
                    <Input
                      value={row.year}
                      onChange={(e) => {
                        const education = [...draft.education];
                        education[i] = { ...row, year: e.target.value };
                        setDraft((d) => ({ ...d, education }));
                      }}
                    />
                  </Field>
                  <Field label="% / CGPA">
                    <Input
                      value={row.score}
                      onChange={(e) => {
                        const education = [...draft.education];
                        education[i] = { ...row, score: e.target.value };
                        setDraft((d) => ({ ...d, education }));
                      }}
                    />
                  </Field>
                  <Field label="Specialization" className="sm:col-span-2">
                    <Input
                      value={row.specialization}
                      onChange={(e) => {
                        const education = [...draft.education];
                        education[i] = { ...row, specialization: e.target.value };
                        setDraft((d) => ({ ...d, education }));
                      }}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft((d) => ({ ...d, education: [...d.education, emptyEducation()] }))
              }
            >
              + Add qualification
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {draft.experience.map((row, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Institution">
                    <Input
                      value={row.institution}
                      onChange={(e) => {
                        const experience = [...draft.experience];
                        experience[i] = { ...row, institution: e.target.value };
                        setDraft((d) => ({ ...d, experience }));
                      }}
                    />
                  </Field>
                  <Field label="Designation">
                    <Input
                      value={row.designation}
                      onChange={(e) => {
                        const experience = [...draft.experience];
                        experience[i] = { ...row, designation: e.target.value };
                        setDraft((d) => ({ ...d, experience }));
                      }}
                    />
                  </Field>
                  <Field label="From">
                    <Input
                      type="date"
                      value={row.fromDate}
                      onChange={(e) => {
                        const experience = [...draft.experience];
                        experience[i] = { ...row, fromDate: e.target.value };
                        setDraft((d) => ({ ...d, experience }));
                      }}
                    />
                  </Field>
                  <Field label="To">
                    <Input
                      type="date"
                      value={row.toDate}
                      onChange={(e) => {
                        const experience = [...draft.experience];
                        experience[i] = { ...row, toDate: e.target.value };
                        setDraft((d) => ({ ...d, experience }));
                      }}
                    />
                  </Field>
                  <Field label="Years">
                    <Input
                      type="number"
                      min={0}
                      value={row.experience}
                      onChange={(e) => {
                        const experience = [...draft.experience];
                        experience[i] = { ...row, experience: e.target.value };
                        setDraft((d) => ({ ...d, experience }));
                      }}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft((d) => ({ ...d, experience: [...d.experience, emptyExperience()] }))
              }
            >
              + Add experience
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Research Area" className="sm:col-span-2">
              <Input
                value={draft.research.researchArea}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, researchArea: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="NET Qualified">
              <select
                className={selectClass}
                value={draft.research.netQualified}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, netQualified: e.target.value },
                  }))
                }
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="SET Qualified">
              <select
                className={selectClass}
                value={draft.research.setQualified}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, setQualified: e.target.value },
                  }))
                }
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="PhD Details" className="sm:col-span-2">
              <Input
                value={draft.research.phdDetails}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, phdDetails: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Publications Count">
              <Input
                value={draft.research.publicationsCount}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, publicationsCount: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Books Published">
              <Input
                value={draft.research.booksPublished}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, booksPublished: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Google Scholar">
              <Input
                value={draft.research.googleScholar}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, googleScholar: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="ORCID">
              <Input
                value={draft.research.orcid}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    research: { ...d.research, orcid: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <CareersFileDropzone
              label="Resume / CV"
              accept=".pdf,application/pdf"
              required
              file={resume}
              onFile={setResume}
              hint="PDF only, maximum 10 MB. This is the most important document."
            />
            <CareersFileDropzone
              label="Passport-size Photo"
              accept="image/*"
              file={photo}
              onFile={setPhoto}
            />
            <CareersFileDropzone
              label="UG Certificate"
              accept=".pdf,image/*"
              file={ugCert}
              onFile={setUgCert}
            />
            <CareersFileDropzone
              label="PG Certificate"
              accept=".pdf,image/*"
              file={pgCert}
              onFile={setPgCert}
            />
            <div>
              <Label className="text-sm">Optional certificates (NET/SET, PhD, experience)</Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                multiple
                className="mt-2"
                onChange={(e) => setOptionalDocs(Array.from(e.target.files ?? []))}
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-50 to-cyan-50/40 p-4">
              <p className="font-semibold text-[#0b1f4a]">Application Summary</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-medium">{draft.personal.fullName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mobile</dt>
                  <dd className="font-medium">{draft.contact.mobile}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium">{draft.contact.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Position</dt>
                  <dd className="font-medium">{job.title}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium">Uploaded documents</p>
              <ul className="mt-2 space-y-1 text-slate-600">
                <li>{resume ? `✓ Resume: ${resume.name}` : '✗ Resume missing'}</li>
                <li>{photo ? `✓ Photo: ${photo.name}` : '○ Photo optional'}</li>
                <li>{ugCert ? `✓ UG: ${ugCert.name}` : '✗ UG certificate missing'}</li>
                <li>{pgCert ? `✓ PG: ${pgCert.name}` : '○ PG optional'}</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input
                type="checkbox"
                checked={draft.declaration}
                onChange={(e) => setDraft((d) => ({ ...d, declaration: e.target.checked }))}
                className="mt-1"
              />
              <span>
                I hereby declare that the information provided is true and correct. I understand
                that any false information may lead to rejection or cancellation of my application.
              </span>
            </label>
            <CareersTurnstile onToken={setTurnstileToken} />
            <input
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              value={draft.website}
              onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
            />
          </div>
        )}
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-4 py-3.5 backdrop-blur sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={saveDraft}
          className="text-slate-600 hover:text-[#0b1f4a]"
        >
          <Save className="mr-2 h-4 w-4" />
          Save draft
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="border-slate-200 bg-white"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          {step < CAREERS_WIZARD_STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              className="bg-gradient-to-r from-[#0b1f4a] to-[#164a7a] shadow-lg shadow-cyan-900/20 hover:from-[#123058] hover:to-[#0b1f4a]"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading}
              className="bg-gradient-to-r from-[#c8102e] to-[#a50d25] shadow-lg shadow-red-900/25 hover:from-[#d41232] hover:to-[#c8102e]"
              onClick={() => void submitApplication()}
            >
              {loading ? 'Submitting…' : 'Submit Application'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}
