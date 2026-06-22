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
    <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#c8102e]">
          Online Application
        </p>
        <h2 className="mt-1 text-lg font-bold text-[#1e3a5f]">{job.title}</h2>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-slate-500">
            <span>
              Step {step + 1} of {CAREERS_WIZARD_STEPS.length}: {CAREERS_WIZARD_STEPS[step]}
            </span>
            <span>{progress}% complete</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#c8102e] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        {savedHint ? <p className="mb-4 text-sm text-emerald-600">{savedHint}</p> : null}

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name *" className="sm:col-span-2">
              <Input
                value={draft.personal.fullName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, personal: { ...d.personal, fullName: e.target.value } }))
                }
              />
            </Field>
            <Field label="Father's Name">
              <Input
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
                className="w-full rounded-md border px-3 py-2 text-sm"
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
                className="w-full rounded-md border px-3 py-2 text-sm"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile Number *">
              <Input
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
                className="w-full rounded-md border px-3 py-2 text-sm"
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
                className="w-full rounded-md border px-3 py-2 text-sm"
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
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-[#1e3a5f]">Application Summary</p>
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
        <Button type="button" variant="ghost" size="sm" onClick={saveDraft}>
          <Save className="mr-2 h-4 w-4" />
          Save draft
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          {step < CAREERS_WIZARD_STEPS.length - 1 ? (
            <Button type="button" onClick={nextStep}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading}
              className="bg-[#c8102e] hover:bg-[#a50d25]"
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
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
