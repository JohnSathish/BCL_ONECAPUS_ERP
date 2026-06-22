'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { cn } from '@/utils/cn';

export function CareersFileDropzone({
  label,
  accept,
  maxMb = 10,
  required,
  file,
  onFile,
  hint,
}: {
  label: string;
  accept: string;
  maxMb?: number;
  required?: boolean;
  file: File | null;
  onFile: (file: File | null) => void;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const validate = useCallback(
    (f: File) => {
      if (f.size > maxMb * 1024 * 1024) {
        setError(`Maximum file size is ${maxMb} MB`);
        return false;
      }
      setError('');
      return true;
    },
    [maxMb],
  );

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (validate(f)) onFile(f);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </p>
      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-emerald-900">{file.name}</p>
              <p className="text-xs text-emerald-700">Uploaded successfully</p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-emerald-800 underline"
            onClick={() => onFile(null)}
          >
            Replace
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition',
            dragging
              ? 'border-[#1e3a5f] bg-sky-50'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100',
          )}
        >
          <Upload className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">Drag & drop or click to upload</p>
          <p className="mt-1 text-xs text-slate-500">PDF up to {maxMb} MB</p>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      )}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!file && accept.includes('pdf') ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <FileText className="h-3.5 w-3.5" />
          Resume/CV should be in PDF format
        </div>
      ) : null}
    </div>
  );
}
