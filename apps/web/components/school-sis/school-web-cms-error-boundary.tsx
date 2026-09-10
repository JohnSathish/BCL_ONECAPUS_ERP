'use client';

import { Component, type ReactNode } from 'react';

type Props = { label: string; children: ReactNode };

type State = { error: Error | null };

export class SchoolWebCmsErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{this.props.label} could not load</p>
          <p className="mt-1 text-red-700">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function schoolWebPublicSiteUrl() {
  if (typeof window === 'undefined') return 'https://stlukestura.in';
  const host = window.location.hostname;
  if (host === 'erp.stlukestura.in') return 'https://stlukestura.in';
  if (host === 'sls.localhost') return 'http://school.localhost:3000';
  return 'http://school.localhost:3000';
}
