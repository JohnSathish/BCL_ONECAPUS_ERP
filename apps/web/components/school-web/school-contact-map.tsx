'use client';

import { useState } from 'react';
import { schoolMapsDirectionsUrl, schoolMapsEmbedSrc } from '@/lib/school-web/maps';

export function SchoolContactMap({
  query,
  locationLabel,
  directionsLabel,
  schoolName,
  address,
  mapsUrl,
  lat,
  lng,
}: {
  query: string;
  locationLabel: string;
  directionsLabel: string;
  schoolName: string;
  address: string;
  mapsUrl?: string;
  lat?: string | number;
  lng?: string | number;
}) {
  const [tab, setTab] = useState<'map' | 'directions'>('map');
  const embed = schoolMapsEmbedSrc({ query, mapsUrl, lat, lng });
  const directions = schoolMapsDirectionsUrl({ query, mapsUrl, lat, lng });

  return (
    <div className="sls-visit-map">
      <div className="sls-visit-tabs" role="tablist" aria-label="Location">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'map'}
          className={tab === 'map' ? 'is-on' : ''}
          onClick={() => setTab('map')}
        >
          {locationLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'directions'}
          className={tab === 'directions' ? 'is-on' : ''}
          onClick={() => setTab('directions')}
        >
          {directionsLabel}
        </button>
      </div>
      {tab === 'map' ? (
        <iframe
          title={`${schoolName} location map`}
          src={embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="sls-visit-directions">
          <p>
            {schoolName}
            <br />
            {address}
          </p>
          <a className="sls-btn sls-btn-navy" href={directions} target="_blank" rel="noreferrer">
            Open in Google Maps <span aria-hidden>→</span>
          </a>
        </div>
      )}
    </div>
  );
}
