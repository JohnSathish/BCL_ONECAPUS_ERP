'use client';

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export function CmsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="sls-cms-card">
      <h3>{title}</h3>
      {description ? <p className="sls-cms-help">{description}</p> : null}
      {children}
    </section>
  );
}

export function CmsField({
  label,
  hint,
  span2,
  children,
}: {
  label: string;
  hint?: string;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`sls-cms-field${span2 ? ' span-2' : ''}`}>
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function CmsInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function CmsTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function CmsSelect(
  props: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode },
) {
  const { children, ...rest } = props;
  return <select {...rest}>{children}</select>;
}

export function CmsToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <span className="sls-cms-toggle">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={checked ? 'is-on' : ''}
        onClick={() => onChange(!checked)}
      />
    </span>
  );
}

export function CmsMedia({
  src,
  alt,
  onFile,
  hint = 'Replace image — drag & drop or browse',
}: {
  src: string;
  alt: string;
  onFile: (file: File) => void;
  hint?: string;
}) {
  return (
    <div className="sls-cms-media">
      {src ? <img src={src} alt={alt} /> : <div style={{ height: 120 }} />}
      <div className="sls-cms-media-actions">
        <p style={{ margin: '0 0 0.5rem' }}>{hint}</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = '';
            if (file) onFile(file);
          }}
        />
      </div>
    </div>
  );
}

export function CmsSaveBar({
  dirty,
  saving,
  saved,
  error,
  onCancel,
  onSave,
}: {
  dirty: boolean;
  saving?: boolean;
  saved?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="sls-cms-save">
      <div>
        {error ? <p className="sls-cms-error">{error}</p> : null}
        {!error && saved && !dirty ? (
          <p className="sls-cms-toast">Changes saved successfully</p>
        ) : null}
        {!error && dirty ? <p>Unsaved changes</p> : null}
        {!error && !dirty && !saved ? <p className="sls-cms-help">All changes are saved</p> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="sls-cms-btn ghost"
          onClick={onCancel}
          disabled={!dirty || saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="sls-cms-btn gold"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

export function CmsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="sls-cms-pagehead">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function CmsButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'gold' | 'ghost' },
) {
  const { variant = 'ghost', className, ...rest } = props;
  return <button className={`sls-cms-btn ${variant} ${className ?? ''}`} {...rest} />;
}
