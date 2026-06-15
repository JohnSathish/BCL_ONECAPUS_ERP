'use client';

import { LandingAiShowcase } from './landing-ai-showcase';
import { LandingCta } from './landing-cta';
import { LandingEcosystem } from './landing-ecosystem';
import { LandingEnterprise } from './landing-enterprise';
import { LandingFooter } from './landing-footer';
import { LandingHero } from './landing-hero';
import { LandingModules } from './landing-modules';
import { LandingNavbar } from './landing-navbar';
import { LandingStats } from './landing-stats';

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-slate-950 text-white">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingModules />
        <LandingEcosystem />
        <LandingAiShowcase />
        <LandingEnterprise />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
