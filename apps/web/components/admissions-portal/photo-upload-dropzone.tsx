'use client';

import { useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { cn } from '@/utils/cn';

type Props = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  previewUrl?: string | null;
  className?: string;
};

export function PhotoUploadDropzone({ onFileSelect, disabled, previewUrl, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file?: File) => {
    if (!file || disabled) return;
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;
    onFileSelect(file);
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
          dragOver ? 'border-[#2563eb] bg-blue-50' : 'border-slate-300 bg-slate-50/80',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Profile preview"
            className="mb-3 h-24 w-24 rounded-full border-2 border-white object-cover shadow-md"
          />
        ) : (
          <Camera className="mb-3 h-10 w-10 text-slate-400" />
        )}
        <p className="text-sm font-medium text-slate-700">
          Drag &amp; drop your photo here or click to browse
        </p>
        <p className="mt-1 text-xs text-slate-500">JPEG or PNG, max 2 MB</p>
        <Upload className="mt-2 h-4 w-4 text-[#2563eb]" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
