import type { Metadata } from 'next';
import Link from 'next/link';
import { Droplets, HeartHandshake, Phone, ShieldPlus } from 'lucide-react';
import { BloodDonorForm } from '@/components/blood-donor-form';
import './blood-donors.css';

export const metadata: Metadata = {
  title: 'DBC Blood Donors',
  description:
    'Register as a Don Bosco College Tura blood donor. We contact registered donors when a matching blood group is required.',
};

export default function BloodDonorsPage() {
  return (
    <main id="main" className="blood-page">
      <header className="blood-hero">
        <div className="shell blood-hero-inner">
          <nav className="blood-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>DBC Blood Donors</span>
          </nav>
          <p className="blood-hero-brand">Don Bosco College Tura</p>
          <h1>DBC Blood Donors</h1>
          <p className="blood-hero-lead">
            Join the college blood donor network and help save lives when your blood group is
            needed.
          </p>
        </div>
      </header>

      <section className="shell blood-layout">
        <BloodDonorForm />

        <aside className="blood-aside">
          <div className="blood-info">
            <h2>Why register?</h2>
            <ul>
              <li>
                <HeartHandshake aria-hidden />
                <span>Be ready to help students, staff and the wider Tura community.</span>
              </li>
              <li>
                <ShieldPlus aria-hidden />
                <span>Your details stay confidential and are used only for donation requests.</span>
              </li>
              <li>
                <Phone aria-hidden />
                <span>We contact you only when your blood group matches a genuine need.</span>
              </li>
              <li>
                <Droplets aria-hidden />
                <span>One registration keeps you in the DBC Blood Donors network.</span>
              </li>
            </ul>
          </div>

          <div className="blood-note">
            <h2>Important</h2>
            <p>
              Please ensure you meet standard blood donation eligibility guidelines before
              registering. If you are unsure, consult a physician or the college office.
            </p>
            <Link href="/contact">Contact the college office →</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
