import {
  SCHOOL_FACILITY_ACADEMIES,
  SCHOOL_FACILITY_CAMPUS,
} from '@/components/school-web/school-facilities';

export function SchoolFacilitiesBody() {
  return (
    <div className="sls-facilities">
      <ul className="sls-facilities-academies">
        {SCHOOL_FACILITY_ACADEMIES.map((item) => (
          <li key={item.title}>
            <span className="sls-facilities-icon" aria-hidden>
              <FacilityIcon name={item.icon} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <span>{item.academy}</span>
            </div>
          </li>
        ))}
      </ul>
      <ul className="sls-facilities-campus">
        {SCHOOL_FACILITY_CAMPUS.map((item) => (
          <li key={item}>
            <span aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FacilityIcon({ name }: { name: string }) {
  if (name === 'taekwondo') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M13.2 3.2a1.7 1.7 0 1 1-1.7 1.7 1.7 1.7 0 0 1 1.7-1.7zM8.2 8.4l3.1-.6 1.6 2.4 3.6-2.2.9 1.5-4.2 2.5-.4 4.6-1.8.2.5-5.1-2.1-3.1-2.4 4.3-1.6-.9zM11 17.2l1.2 4.1h-1.9l.7-4.1z"
        />
      </svg>
    );
  }
  if (name === 'football') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M12 4a8 8 0 1 1-8 8 8 8 0 0 1 8-8zm0 1.7a6.3 6.3 0 1 0 6.3 6.3A6.3 6.3 0 0 0 12 5.7zm0 1.6 1.7 1.2-.6 2H10.9l-.6-2zm-3 2.2.9 1.6-1.3 1.8h-2a6 6 0 0 1 2.4-3.4zm6 0A6 6 0 0 1 17.4 13h-2l-1.3-1.8zM8.6 14.4l.6 1.9-1.2 1.5a6 6 0 0 1-.9-3.4zm6.8 0a6 6 0 0 1-.9 3.4l-1.2-1.5.6-1.9zM10.6 17h2.8l.4 1.2A6 6 0 0 1 12 18.6 6 6 0 0 1 10.2 18.2z"
        />
      </svg>
    );
  }
  if (name === 'basketball') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M12 3a9 9 0 1 1-9 9 9 9 0 0 1 9-9zm0 1.8a7.2 7.2 0 0 0-6.4 4h4.1A11 11 0 0 1 12 4.8zm0 0a11 11 0 0 1 2.3 4h4.1A7.2 7.2 0 0 0 12 4.8zM4.8 12c0 .4 0 .8.1 1.2h4.3A13 13 0 0 1 9 12a13 13 0 0 1 .2-1.2H4.9c-.1.4-.1.8-.1 1.2zm14.4 0c0-.4 0-.8-.1-1.2h-4.3A13 13 0 0 1 15 12a13 13 0 0 1-.2 1.2h4.3c.1-.4.1-.8.1-1.2zM5.6 15.2A7.2 7.2 0 0 0 12 19.2a11 11 0 0 1-2.3-4zm12.8 0h-4.1A11 11 0 0 1 12 19.2a7.2 7.2 0 0 0 6.4-4z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path
        fill="currentColor"
        d="M12 4c2.2 2.6 4.6 4 6.6 4 .2 2.8-1.2 5.7-4.1 7.5C12.7 16.8 10 17 8.2 16c-1.2 1.6-2 3.4-2.2 5H4c.3-2.4 1.4-4.7 3.2-6.6C5.8 12.4 5 10.2 5.2 8 7.4 8.2 9.8 6.8 12 4zm0 2.4C10.4 7.8 8.6 8.8 6.9 9.1c.3 1.5.9 2.9 2 4 1.6.4 3.4.1 5.1-.9 1.9-1.2 2.8-3 2.9-4.6-1.8-.2-3.5-1.1-4.9-3.2z"
      />
    </svg>
  );
}
