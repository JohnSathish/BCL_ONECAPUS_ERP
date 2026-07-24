'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Droplets, Send, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { bloodDonorSchema } from '@/lib/forms';

type DonorValues = z.input<typeof bloodDonorSchema>;

const GENDERS = ['Male', 'Female', 'Other'] as const;
const CONTACT_METHODS = ['Email', 'Phone', 'WhatsApp'] as const;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export function BloodDonorForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DonorValues>({
    resolver: zodResolver(bloodDonorSchema),
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      gender: undefined,
      phone: '',
      email: '',
      preferredContact: 'Email',
      bloodGroup: undefined,
      lastDonationDate: '',
      streetAddress: '',
      city: '',
      state: '',
      pincode: '',
      medicalNotes: '',
      eligible: false,
      company: '',
    },
  });
  const [status, setStatus] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  return (
    <form
      className="blood-form-panel"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setOk(null);
        setStatus('Submitting…');
        const response = await fetch('/api/blood-donors', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        });
        const result = (await response.json()) as { message?: string };
        const message =
          result.message ??
          (response.ok ? 'Registration accepted.' : 'Unable to submit registration.');
        setStatus(message);
        setOk(response.ok);
        if (response.ok) reset();
      })}
    >
      <header className="blood-form-head">
        <span className="blood-form-icon" aria-hidden>
          <Droplets />
        </span>
        <div>
          <h2>Blood donor registration</h2>
          <p>Register once. We will contact you when your blood group is required.</p>
        </div>
      </header>

      <div className="blood-form-grid">
        <label className="blood-field">
          <span>Full Name *</span>
          <input
            autoComplete="name"
            placeholder="Enter your full name"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
          {errors.fullName ? <em>{errors.fullName.message}</em> : null}
        </label>

        <label className="blood-field">
          <span>Date of Birth *</span>
          <input
            type="date"
            aria-invalid={Boolean(errors.dateOfBirth)}
            {...register('dateOfBirth')}
          />
          {errors.dateOfBirth ? <em>{errors.dateOfBirth.message}</em> : null}
        </label>

        <label className="blood-field">
          <span>Gender *</span>
          <select defaultValue="" aria-invalid={Boolean(errors.gender)} {...register('gender')}>
            <option value="" disabled>
              Select gender
            </option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
          {errors.gender ? <em>{errors.gender.message}</em> : null}
        </label>

        <label className="blood-field">
          <span>Phone Number *</span>
          <input
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter phone number"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
          {errors.phone ? <em>{errors.phone.message}</em> : null}
        </label>

        <label className="blood-field">
          <span>Email *</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="Enter email address"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email ? <em>{errors.email.message}</em> : null}
        </label>

        <label className="blood-field">
          <span>Preferred Contact Method</span>
          <select {...register('preferredContact')}>
            {CONTACT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>

        <label className="blood-field">
          <span>Blood Group *</span>
          <select
            defaultValue=""
            aria-invalid={Boolean(errors.bloodGroup)}
            {...register('bloodGroup')}
          >
            <option value="" disabled>
              Select blood group
            </option>
            {BLOOD_GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          {errors.bloodGroup ? <em>{errors.bloodGroup.message}</em> : null}
        </label>

        <label className="blood-field">
          <span>Last Donation Date</span>
          <input type="date" {...register('lastDonationDate')} />
          {errors.lastDonationDate ? <em>{errors.lastDonationDate.message}</em> : null}
        </label>

        <label className="blood-field blood-field-full">
          <span>Street Address</span>
          <input
            autoComplete="street-address"
            placeholder="House / street / locality"
            {...register('streetAddress')}
          />
        </label>

        <label className="blood-field">
          <span>City</span>
          <input autoComplete="address-level2" placeholder="City" {...register('city')} />
        </label>

        <label className="blood-field">
          <span>State</span>
          <input autoComplete="address-level1" placeholder="State" {...register('state')} />
        </label>

        <label className="blood-field">
          <span>Pincode</span>
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="Pincode"
            {...register('pincode')}
          />
        </label>

        <label className="blood-field blood-field-full">
          <span>Medical Conditions / Notes</span>
          <textarea
            rows={4}
            placeholder="Any medical conditions or notes we should know"
            {...register('medicalNotes')}
          />
        </label>
      </div>

      <label className="blood-consent">
        <input type="checkbox" {...register('eligible')} />
        <span>I confirm I am eligible to donate blood.</span>
      </label>
      {errors.eligible ? <em className="blood-consent-error">{errors.eligible.message}</em> : null}

      <p className="blood-agree">
        By submitting this form you agree to be contacted when a matching blood donation request is
        identified.
      </p>

      <input
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        {...register('company')}
      />

      <div className="blood-form-actions">
        <Button type="submit" disabled={isSubmitting} className="blood-submit">
          Submit Registration <Send aria-hidden />
        </Button>
        <p className="blood-privacy">
          <ShieldCheck aria-hidden />
          We will contact you when your blood group is required.
        </p>
      </div>

      <p
        className={`blood-form-status${ok === false ? ' is-error' : ''}${ok ? ' is-ok' : ''}`}
        aria-live="polite"
      >
        {status}
      </p>
    </form>
  );
}
