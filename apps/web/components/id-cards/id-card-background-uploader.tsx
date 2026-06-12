'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Replace, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BACKGROUND_ACCEPT,
  BACKGROUND_MAX_MB,
  validateBackgroundFile,
} from '@/components/id-cards/id-card-background-utils';
import { uploadIdCardBackground } from '@/services/id-cards';
import { apiErrorMessage } from '@/utils/api-error';

export type BackgroundUploadResult = {
  imageUrl: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
};

type Props = {
  side: 'front' | 'back';
  templateId?: string;
  label?: string;
  existingUrl?: string | null;
  onUploaded: (result: BackgroundUploadResult) => void;
  compact?: boolean;
};

export function IdCardBackgroundUploader({
  side,
  templateId,
  label,
  existingUrl,
  onUploaded,
  compact,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const validationError = validateBackgroundFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const result = await uploadIdCardBackground(file, { side, templateId });
      onUploaded(result);
    } catch (e) {
      setError(apiErrorMessage(e, 'Upload failed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {label ? <Label className="text-xs">{label}</Label> : null}
      <input
        ref={inputRef}
        type="file"
        accept={BACKGROUND_ACCEPT}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={existingUrl ? 'outline' : 'default'}
          disabled={uploading}
          onClick={pickFile}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : existingUrl ? (
            <Replace className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          {existingUrl ? 'Replace Background' : 'Upload Background'}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        PNG, JPG, JPEG, WEBP · max {BACKGROUND_MAX_MB} MB · transparent PNG recommended · print at
        300 DPI
      </p>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}

type WizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: {
    name: string;
    holderType: string;
    front: BackgroundUploadResult | null;
    back: BackgroundUploadResult | null;
  }) => Promise<void>;
  creating?: boolean;
};

export function IdCardBackgroundTemplateWizard({
  open,
  onOpenChange,
  onCreate,
  creating,
}: WizardProps) {
  const [name, setName] = useState('');
  const [holderType, setHolderType] = useState('STUDENT');
  const [front, setFront] = useState<BackgroundUploadResult | null>(null);
  const [back, setBack] = useState<BackgroundUploadResult | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    if (!front && !back) {
      setError('Upload at least a front or back background.');
      return;
    }
    setError('');
    await onCreate({ name: name.trim(), holderType, front, back });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ImagePlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Upload Background Template</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Design your card in Photoshop, Canva, or Figma — export front and back as PNG, then
              place dynamic fields on top in the designer.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-xs">Template name</Label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student ID 2026"
            />
          </div>
          <div>
            <Label className="text-xs">Holder type</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={holderType}
              onChange={(e) => setHolderType(e.target.value)}
            >
              <option value="STUDENT">Student</option>
              <option value="STAFF">Staff</option>
              <option value="LIBRARY">Library</option>
              <option value="VISITOR">Visitor</option>
            </select>
          </div>
          <IdCardBackgroundUploader
            side="front"
            label="Front side background"
            existingUrl={front?.imageUrl}
            onUploaded={setFront}
          />
          <IdCardBackgroundUploader
            side="back"
            label="Back side background (optional)"
            existingUrl={back?.imageUrl}
            onUploaded={setBack}
          />
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            Future: Import PSD templates directly (roadmap). For now, export flattened PNG/JPG from
            your design tool.
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create &amp; Open Designer
          </Button>
        </div>
      </div>
    </div>
  );
}
