'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';
import {
  asOptions,
  asValidation,
  type FeedbackAnswerValue,
  type FeedbackQuestionDto,
} from './feedback-question-types';

type Props = {
  question: FeedbackQuestionDto;
  value?: FeedbackAnswerValue;
  onChange: (next: FeedbackAnswerValue) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function FeedbackQuestionField({ question, value, onChange, disabled, compact }: Props) {
  const type = question.questionType ?? 'LIKERT_5';
  const options = asOptions(question.options, type);
  const validation = asValidation(question.validation);
  const placeholder = question.placeholder ?? undefined;

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <div>
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-sm')}>
          {question.prompt}
          {question.required ? <span className="text-destructive"> *</span> : null}
        </p>
        {question.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{question.description}</p>
        ) : null}
        {question.helpText ? (
          <p className="mt-0.5 text-xs text-muted-foreground/80">{question.helpText}</p>
        ) : null}
      </div>

      {(type === 'LIKERT_5' ||
        type === 'rating' ||
        type === 'single_choice' ||
        type === 'yes_no' ||
        type === 'true_false') && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const selected =
              value?.rating != null
                ? String(value.rating) === opt.value
                : value?.valueText === opt.value ||
                  (value?.valueBool === true && (opt.value === 'yes' || opt.value === 'true')) ||
                  (value?.valueBool === false && (opt.value === 'no' || opt.value === 'false'));
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (type === 'LIKERT_5' || type === 'rating') {
                    onChange({ rating: Number(opt.value), valueText: opt.label });
                  } else if (type === 'yes_no' || type === 'true_false') {
                    const boolVal = opt.value === 'yes' || opt.value === 'true';
                    onChange({ valueBool: boolVal, valueText: opt.value });
                  } else {
                    onChange({ valueText: opt.value });
                  }
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                  disabled && 'opacity-50',
                )}
              >
                {type === 'rating' ? '★'.repeat(Number(opt.value) || 0) || opt.label : opt.label}
              </button>
            );
          })}
        </div>
      )}

      {type === 'multi_choice' && (
        <div className="space-y-2">
          {options.map((opt) => {
            const selected = Array.isArray(value?.valueJson)
              ? (value!.valueJson as string[]).includes(opt.value)
              : false;
            return (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected}
                  onChange={(e) => {
                    const prev = Array.isArray(value?.valueJson)
                      ? ([...(value!.valueJson as string[])] as string[])
                      : [];
                    const next = e.target.checked
                      ? [...prev, opt.value]
                      : prev.filter((v) => v !== opt.value);
                    onChange({ valueJson: next });
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}

      {type === 'dropdown' && (
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          disabled={disabled}
          value={value?.valueText ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
        >
          <option value="">{placeholder || 'Select…'}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {type === 'short_text' && (
        <Input
          disabled={disabled}
          placeholder={placeholder}
          value={value?.valueText ?? ''}
          maxLength={validation.maxLength}
          onChange={(e) => onChange({ valueText: e.target.value })}
        />
      )}

      {type === 'long_text' && (
        <textarea
          disabled={disabled}
          placeholder={placeholder}
          value={value?.valueText ?? ''}
          maxLength={validation.maxLength}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(e) => onChange({ valueText: e.target.value })}
        />
      )}

      {(type === 'integer' || type === 'decimal') && (
        <Input
          type="number"
          disabled={disabled}
          placeholder={placeholder}
          value={value?.valueNumber ?? ''}
          min={validation.min}
          max={validation.max}
          step={type === 'decimal' ? (validation.step ?? 0.1) : 1}
          onChange={(e) => {
            const n = e.target.value === '' ? undefined : Number(e.target.value);
            onChange({ valueNumber: n });
          }}
        />
      )}

      {(type === 'date' || type === 'time' || type === 'datetime') && (
        <Input
          type={type === 'datetime' ? 'datetime-local' : type}
          disabled={disabled}
          value={value?.valueDate ?? ''}
          onChange={(e) => onChange({ valueDate: e.target.value })}
        />
      )}

      {type === 'file_upload' && (
        <div className="space-y-1">
          <Input
            type="url"
            disabled={disabled}
            placeholder={placeholder || 'Paste uploaded file URL'}
            value={
              value?.valueJson && typeof value.valueJson === 'object'
                ? String((value.valueJson as { url?: string }).url ?? '')
                : ''
            }
            onChange={(e) =>
              onChange({
                valueJson: {
                  url: e.target.value,
                  name: e.target.value.split('/').pop() || 'file',
                },
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Upload via Documents / media library, then paste the public URL here.
          </p>
        </div>
      )}
    </div>
  );
}

export function FeedbackQuestionPreview({ question }: { question: FeedbackQuestionDto }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
      <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
        Live preview
      </Label>
      <FeedbackQuestionField
        question={question}
        value={{}}
        onChange={() => undefined}
        disabled
        compact
      />
    </div>
  );
}
