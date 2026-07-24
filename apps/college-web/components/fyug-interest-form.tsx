'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Cake,
  Check,
  CheckCircle2,
  Circle,
  Droplets,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Upload,
  User,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { fyugInterestSchema } from '@/lib/forms';
import {
  FYUG_GENDERS,
  FYUG_HONOURS_SUBJECTS,
  FYUG_MAJOR_MINOR_SUBJECTS,
  FYUG_UNIVERSITIES,
  INDIAN_STATES,
} from '@/lib/fyug-options';

type FormValues = z.input<typeof fyugInterestSchema>;

const DRAFT_KEY = 'dbc-fyug-interest-draft-v1';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't Know"] as const;

const STEPS = [
  { id: 'personal', label: 'Personal', number: '01' },
  { id: 'parent', label: 'Parent', number: '02' },
  { id: 'academic', label: 'Academic', number: '03' },
  { id: 'upload', label: 'Upload', number: '04' },
  { id: 'submit', label: 'Submit', number: '05' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function SectionHeader({ number, title, lead }: { number: string; title: string; lead: string }) {
  return (
    <header className="fyug-section-head">
      <span className="fyug-section-num" aria-hidden>
        {number}
      </span>
      <div>
        <h3>{title}</h3>
        <p className="fyug-section-lead">{lead}</p>
      </div>
    </header>
  );
}

export function FyugInterestForm() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(fyugInterestSchema),
    defaultValues: {
      fullName: '',
      gender: undefined,
      dateOfBirth: '',
      mobile: '',
      whatsapp: '',
      whatsappSameAsMobile: true,
      email: '',
      state: undefined,
      district: '',
      pinCode: '',
      bloodGroup: '',
      fatherName: '',
      fatherMobile: '',
      motherName: '',
      motherMobile: '',
      collegeLastAttended: '',
      affiliatedUniversity: undefined,
      majorCourse: undefined,
      minorCourse: undefined,
      applyingHonoursIn: undefined,
      cuetScore: '',
      cgpaSemesterV: '',
      percentageSemesterV: '',
      hasBackPapers: undefined,
      declarationAccepted: false,
      signatureName: '',
      company: '',
    },
  });

  const values = watch();
  const whatsappSame = values.whatsappSameAsMobile;
  const gender = values.gender;
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeStep, setActiveStep] = useState<StepId>('personal');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  const applyPhoto = useCallback((file: File | null) => {
    setPhotoError('');
    if (!file) {
      setPhoto(null);
      setPreview(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhoto(null);
      setPreview(null);
      setPhotoError('Photograph must be 2MB or smaller');
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        hydrated.current = true;
        return;
      }
      const draft = JSON.parse(raw) as Partial<FormValues>;
      Object.entries(draft).forEach(([key, value]) => {
        if (key === 'company' || value == null) return;
        setValue(key as keyof FormValues, value as never);
      });
    } catch {
      /* ignore corrupt draft */
    }
    hydrated.current = true;
  }, [setValue]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const snapshot = { ...getValues() };
        delete (snapshot as { company?: string }).company;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
        setSavedFlash(true);
      } catch {
        /* ignore quota */
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [values, getValues]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [savedFlash]);

  useEffect(() => {
    const nodes = STEPS.map((step) => document.getElementById(`fyug-step-${step.id}`)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target.id) return;
        const id = visible.target.id.replace('fyug-step-', '') as StepId;
        setActiveStep(id);
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0.2, 0.45, 0.7] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const stepComplete = useMemo(() => {
    const filled = (value: unknown) => Boolean(String(value ?? '').trim());
    return {
      personal:
        filled(values.fullName) &&
        filled(values.gender) &&
        filled(values.dateOfBirth) &&
        filled(values.mobile) &&
        filled(values.email) &&
        filled(values.state) &&
        filled(values.district) &&
        filled(values.pinCode),
      parent:
        filled(values.fatherName) &&
        filled(values.fatherMobile) &&
        filled(values.motherName) &&
        filled(values.motherMobile),
      academic:
        filled(values.collegeLastAttended) &&
        filled(values.affiliatedUniversity) &&
        filled(values.majorCourse) &&
        filled(values.minorCourse) &&
        filled(values.applyingHonoursIn) &&
        filled(values.hasBackPapers),
      upload: Boolean(photo),
      submit: Boolean(values.declarationAccepted) && filled(values.signatureName),
    } satisfies Record<StepId, boolean>;
  }, [values, photo]);

  const progress = useMemo(() => {
    const checks = Object.values(stepComplete);
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [stepComplete]);

  return (
    <div className="fyug-workspace">
      <div className={`fyug-save-pill${savedFlash ? ' is-visible' : ''}`} aria-live="polite">
        <CheckCircle2 aria-hidden />
        Saved automatically
      </div>

      <div className="fyug-workspace-main">
        <nav className="fyug-stepper" aria-label="Form progress">
          {STEPS.map((step, index) => {
            const done = stepComplete[step.id];
            const active = activeStep === step.id;
            return (
              <a
                key={step.id}
                href={`#fyug-step-${step.id}`}
                className={`fyug-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
              >
                <span className="fyug-step-index" aria-hidden>
                  {done ? <Check size={14} /> : index + 1}
                </span>
                <span className="fyug-step-label">{step.label}</span>
              </a>
            );
          })}
        </nav>

        <form
          className="fyug-form-panel"
          noValidate
          onSubmit={handleSubmit(async (formValues) => {
            setOk(null);
            setPhotoError('');
            if (!photo) {
              setPhotoError('Applicant photograph is required');
              setStatus('Please upload your photograph.');
              setOk(false);
              document.getElementById('fyug-step-upload')?.scrollIntoView({ behavior: 'smooth' });
              return;
            }
            setStatus('Submitting…');
            const body = new FormData();
            Object.entries(formValues).forEach(([key, value]) => {
              if (key === 'company') return;
              if (typeof value === 'boolean') body.append(key, value ? 'true' : 'false');
              else if (value != null) body.append(key, String(value));
            });
            body.append('photograph', photo);
            const response = await fetch('/api/fyug-interest', { method: 'POST', body });
            const result = (await response.json()) as { message?: string };
            const message =
              result.message ??
              (response.ok ? 'Registration accepted.' : 'Unable to submit registration.');
            setStatus(message);
            setOk(response.ok);
            if (response.ok) {
              reset();
              setPhoto(null);
              setPreview(null);
              localStorage.removeItem(DRAFT_KEY);
            }
          })}
        >
          <header className="fyug-form-head">
            <span className="fyug-form-icon" aria-hidden>
              <GraduationCap />
            </span>
            <div>
              <h2>Interest registration</h2>
              <p>Fourth-Year Undergraduate Honours Programme · Academic session 2026</p>
            </div>
          </header>

          <section className="fyug-section" id="fyug-step-personal">
            <SectionHeader
              number="01"
              title="Personal Information"
              lead="Basic details of the applicant"
            />
            <div className="fyug-form-grid">
              <label className="fyug-field">
                <span>
                  <User aria-hidden /> Full Name *
                </span>
                <input
                  autoComplete="name"
                  placeholder="ENTER YOUR FULL NAME"
                  style={{ textTransform: 'uppercase' }}
                  aria-invalid={Boolean(errors.fullName)}
                  {...register('fullName')}
                />
                <small className="fyug-hint">
                  Enter your name exactly as it appears on your Semester V marksheet.
                </small>
                {errors.fullName ? <em>{errors.fullName.message}</em> : null}
              </label>

              <label className="fyug-field">
                <span>
                  <Cake aria-hidden /> Date of Birth *
                </span>
                <input
                  type="date"
                  aria-invalid={Boolean(errors.dateOfBirth)}
                  {...register('dateOfBirth')}
                />
                {errors.dateOfBirth ? <em>{errors.dateOfBirth.message}</em> : null}
              </label>

              <fieldset className="fyug-field">
                <legend>Gender *</legend>
                <div className="fyug-gender-grid">
                  {FYUG_GENDERS.map((option) => (
                    <label
                      key={option}
                      className={`fyug-gender-card${gender === option ? ' is-selected' : ''}`}
                    >
                      <input type="radio" value={option} {...register('gender')} />
                      <span className="fyug-gender-mark" aria-hidden>
                        {option === 'Male' ? '♂' : '♀'}
                      </span>
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {errors.gender ? <em>{errors.gender.message}</em> : null}
              </fieldset>

              <label className="fyug-field">
                <span>
                  <Droplets aria-hidden /> Blood Group
                </span>
                <select defaultValue="" {...register('bloodGroup')}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fyug-field">
                <span>
                  <Phone aria-hidden /> Mobile Number *
                </span>
                <input
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  aria-invalid={Boolean(errors.mobile)}
                  {...register('mobile')}
                />
                {errors.mobile ? <em>{errors.mobile.message}</em> : null}
              </label>

              <div className="fyug-field">
                <span>
                  <Phone aria-hidden /> WhatsApp Number
                </span>
                <input
                  inputMode="tel"
                  placeholder="WhatsApp number"
                  disabled={Boolean(whatsappSame)}
                  {...register('whatsapp')}
                />
                <label className="fyug-toggle">
                  <input
                    type="checkbox"
                    {...register('whatsappSameAsMobile')}
                    onChange={(event) => {
                      setValue('whatsappSameAsMobile', event.target.checked);
                      if (event.target.checked) setValue('whatsapp', '');
                    }}
                  />
                  <span className="fyug-toggle-track" aria-hidden />
                  <span>Use mobile number as WhatsApp</span>
                </label>
              </div>

              <label className="fyug-field">
                <span>
                  <Mail aria-hidden /> Email Address *
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email ? <em>{errors.email.message}</em> : null}
              </label>

              <label className="fyug-field">
                <span>
                  <MapPin aria-hidden /> State *
                </span>
                <select defaultValue="" aria-invalid={Boolean(errors.state)} {...register('state')}>
                  <option value="" disabled>
                    Select state
                  </option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                {errors.state ? <em>{errors.state.message}</em> : null}
              </label>

              <label className="fyug-field">
                <span>
                  <MapPin aria-hidden /> District *
                </span>
                <input
                  autoComplete="address-level2"
                  placeholder="Enter your district"
                  aria-invalid={Boolean(errors.district)}
                  {...register('district')}
                />
                {errors.district ? <em>{errors.district.message}</em> : null}
              </label>

              <label className="fyug-field">
                <span>
                  <Hash aria-hidden /> PIN Code *
                </span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="postal-code"
                  placeholder="6-digit PIN code"
                  aria-invalid={Boolean(errors.pinCode)}
                  {...register('pinCode')}
                />
                {errors.pinCode ? <em>{errors.pinCode.message}</em> : null}
              </label>
            </div>
          </section>

          <section className="fyug-section" id="fyug-step-parent">
            <SectionHeader
              number="02"
              title="Parent Details"
              lead="Contact information of parents or guardians"
            />
            <div className="fyug-form-grid">
              <label className="fyug-field">
                <span>
                  <User aria-hidden /> Father&apos;s Name *
                </span>
                <input aria-invalid={Boolean(errors.fatherName)} {...register('fatherName')} />
                {errors.fatherName ? <em>{errors.fatherName.message}</em> : null}
              </label>
              <label className="fyug-field">
                <span>
                  <Phone aria-hidden /> Father&apos;s Mobile *
                </span>
                <input
                  inputMode="tel"
                  aria-invalid={Boolean(errors.fatherMobile)}
                  {...register('fatherMobile')}
                />
                {errors.fatherMobile ? <em>{errors.fatherMobile.message}</em> : null}
              </label>
              <label className="fyug-field">
                <span>
                  <User aria-hidden /> Mother&apos;s Name *
                </span>
                <input aria-invalid={Boolean(errors.motherName)} {...register('motherName')} />
                {errors.motherName ? <em>{errors.motherName.message}</em> : null}
              </label>
              <label className="fyug-field">
                <span>
                  <Phone aria-hidden /> Mother&apos;s Mobile *
                </span>
                <input
                  inputMode="tel"
                  aria-invalid={Boolean(errors.motherMobile)}
                  {...register('motherMobile')}
                />
                {errors.motherMobile ? <em>{errors.motherMobile.message}</em> : null}
              </label>
            </div>
          </section>

          <section className="fyug-section" id="fyug-step-academic">
            <SectionHeader
              number="03"
              title="Academic Information"
              lead="Previous college, courses studied, and honours preference"
            />
            <div className="fyug-form-grid">
              <label className="fyug-field fyug-field-full">
                <span>Name of College Last Attended *</span>
                <input
                  aria-invalid={Boolean(errors.collegeLastAttended)}
                  {...register('collegeLastAttended')}
                />
                <small className="fyug-hint">
                  College where you completed Semester V of the FYUP programme.
                </small>
                {errors.collegeLastAttended ? <em>{errors.collegeLastAttended.message}</em> : null}
              </label>
              <label className="fyug-field fyug-field-full">
                <span>Affiliated University *</span>
                <select
                  defaultValue=""
                  aria-invalid={Boolean(errors.affiliatedUniversity)}
                  {...register('affiliatedUniversity')}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {FYUG_UNIVERSITIES.map((university) => (
                    <option key={university} value={university}>
                      {university}
                    </option>
                  ))}
                </select>
                {errors.affiliatedUniversity ? (
                  <em>{errors.affiliatedUniversity.message}</em>
                ) : null}
              </label>
              <label className="fyug-field">
                <span>MAJOR Course Studied in UG *</span>
                <select
                  defaultValue=""
                  aria-invalid={Boolean(errors.majorCourse)}
                  {...register('majorCourse')}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {FYUG_MAJOR_MINOR_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                {errors.majorCourse ? <em>{errors.majorCourse.message}</em> : null}
              </label>
              <label className="fyug-field">
                <span>MINOR Course Studied in UG *</span>
                <select
                  defaultValue=""
                  aria-invalid={Boolean(errors.minorCourse)}
                  {...register('minorCourse')}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {FYUG_MAJOR_MINOR_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                {errors.minorCourse ? <em>{errors.minorCourse.message}</em> : null}
              </label>
              <label className="fyug-field fyug-field-full">
                <span>Applying for Fourth-Year Honours in *</span>
                <select
                  defaultValue=""
                  aria-invalid={Boolean(errors.applyingHonoursIn)}
                  {...register('applyingHonoursIn')}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {FYUG_HONOURS_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                {errors.applyingHonoursIn ? <em>{errors.applyingHonoursIn.message}</em> : null}
              </label>
              <label className="fyug-field">
                <span>CUET 2026 Score</span>
                <input placeholder="Optional" {...register('cuetScore')} />
              </label>
              <label className="fyug-field">
                <span>CGPA till Semester V</span>
                <input placeholder="Optional" {...register('cgpaSemesterV')} />
              </label>
              <label className="fyug-field">
                <span>Percentage till Semester V</span>
                <input placeholder="Optional" {...register('percentageSemesterV')} />
              </label>
              <fieldset className="fyug-field fyug-field-full">
                <legend>Any back papers from Semester I to V? *</legend>
                <div className="fyug-gender-grid fyug-yesno-grid">
                  {(['No', 'Yes'] as const).map((option) => (
                    <label
                      key={option}
                      className={`fyug-gender-card${
                        values.hasBackPapers === option ? ' is-selected' : ''
                      }`}
                    >
                      <input type="radio" value={option} {...register('hasBackPapers')} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {errors.hasBackPapers ? <em>{errors.hasBackPapers.message}</em> : null}
              </fieldset>
            </div>
          </section>

          <section className="fyug-section" id="fyug-step-upload">
            <SectionHeader
              number="04"
              title="Upload Photograph"
              lead="Clear passport-style photo for your application file"
            />
            <div
              className={`fyug-upload-zone${dragOver ? ' is-drag' : ''}${preview ? ' has-file' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                applyPhoto(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="sr-only"
                onChange={(event) => applyPhoto(event.target.files?.[0] ?? null)}
              />
              {preview ? (
                <div className="fyug-upload-ready">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="fyug-upload-preview" />
                  <div className="fyug-upload-ready-copy">
                    <p className="fyug-upload-ok">
                      <CheckCircle2 aria-hidden /> Photograph uploaded
                    </p>
                    <p>{photo?.name}</p>
                    <div className="fyug-upload-actions">
                      <button type="button" onClick={() => window.open(preview, '_blank')}>
                        Preview
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()}>
                        Replace
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="fyug-upload-empty"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UserRound aria-hidden />
                  <strong>Drag &amp; Drop</strong>
                  <span>or</span>
                  <em>
                    <Upload aria-hidden /> Browse Photograph
                  </em>
                  <small>PNG · JPG · Max 2 MB</small>
                </button>
              )}
            </div>
            {photoError ? <em className="fyug-consent-error">{photoError}</em> : null}
          </section>

          <section className="fyug-section fyug-submit-section" id="fyug-step-submit">
            <SectionHeader
              number="05"
              title="Review & Submit"
              lead="Confirm accuracy and provide your signature"
            />
            <div className="fyug-submit-card">
              <label className="fyug-consent">
                <input type="checkbox" {...register('declarationAccepted')} />
                <span>
                  I confirm all details are correct. I hereby declare that the information furnished
                  above is true to the best of my knowledge. If any information is found false, my
                  application is liable to be cancelled.
                </span>
              </label>
              {errors.declarationAccepted ? (
                <em className="fyug-consent-error">{errors.declarationAccepted.message}</em>
              ) : null}

              <label className="fyug-field fyug-field-full">
                <span>
                  <User aria-hidden /> Signature *
                </span>
                <input
                  placeholder="Type your full name as signature"
                  aria-invalid={Boolean(errors.signatureName)}
                  {...register('signatureName')}
                />
                <small className="fyug-hint">Type your name instead of drawing a signature.</small>
                {errors.signatureName ? <em>{errors.signatureName.message}</em> : null}
              </label>

              <input
                className="honeypot"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                {...register('company')}
              />

              <div className="fyug-form-actions">
                <Button type="submit" disabled={isSubmitting} className="fyug-submit">
                  Submit Interest <Send aria-hidden />
                </Button>
                <p className="fyug-privacy">
                  <ShieldCheck aria-hidden />
                  Your details are stored securely for admissions review.
                </p>
              </div>

              <p
                className={`fyug-form-status${ok === false ? ' is-error' : ''}${ok ? ' is-ok' : ''}`}
                aria-live="polite"
              >
                {status}
              </p>
            </div>
          </section>
        </form>
      </div>

      <aside className="fyug-summary" aria-label="Application summary">
        <div className="fyug-summary-card">
          <h2>Application</h2>
          <ul>
            {STEPS.map((step) => {
              const done = stepComplete[step.id];
              return (
                <li key={step.id} className={done ? 'is-done' : ''}>
                  {done ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
                  <a href={`#fyug-step-${step.id}`}>{step.label}</a>
                </li>
              );
            })}
          </ul>
          <div className="fyug-progress">
            <div className="fyug-progress-label">
              <span>Progress</span>
              <strong>{progress}%</strong>
            </div>
            <div className="fyug-progress-track" aria-hidden>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
