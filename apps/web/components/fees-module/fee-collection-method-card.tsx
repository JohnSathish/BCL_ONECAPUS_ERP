'use client';

import { useMemo } from 'react';
import type { CollectionModesConfig } from '@/types/fee-cycle';
import {
  type DeskPaymentFormValues,
  type DeskPaymentMethodDef,
  type DeskPaymentMethodId,
  type PaymentMethodSource,
  enabledDeskPaymentMethods,
} from '@/lib/fee-collection-methods';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PaymentFieldsProps = {
  collectionModes?: CollectionModesConfig;
  methodId: DeskPaymentMethodId | '';
  values: DeskPaymentFormValues;
  collectedByName?: string;
  methodSource?: PaymentMethodSource | null;
  onMethodChange: (id: DeskPaymentMethodId | '') => void;
  onValuesChange: (values: DeskPaymentFormValues) => void;
  selectId?: string;
  /** Active online gateway label, e.g. Atom / Razorpay */
  gatewayName?: string;
};

const SOURCE_HINT: Record<PaymentMethodSource, string> = {
  INSTITUTION_DEFAULT: 'Default from institution settings',
  CASHIER_LAST_USED: 'Your last used method',
  SINGLE_MODE: 'Only enabled method',
  MANUAL: 'Selected manually',
};

export function FeeCollectionPaymentFields({
  collectionModes,
  methodId,
  values,
  collectedByName,
  methodSource,
  onMethodChange,
  onValuesChange,
  gatewayName = 'payment gateway',
  selectId = 'desk-payment-method',
}: PaymentFieldsProps) {
  const methods = useMemo(() => enabledDeskPaymentMethods(collectionModes), [collectionModes]);
  const method = methods.find((m) => m.id === methodId);

  function setField(key: string, value: string) {
    onValuesChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="space-y-1">
        <Label htmlFor={selectId}>Payment method *</Label>
        <select
          id={selectId}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={methodId}
          onChange={(e) => onMethodChange(e.target.value as DeskPaymentMethodId | '')}
        >
          <option value="">Select payment method…</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {methodId === m.id && methodSource && methodSource !== 'MANUAL' ? ' (Default)' : ''}
            </option>
          ))}
        </select>
        {methodId && methodSource && methodSource !== 'MANUAL' ? (
          <p className="text-xs text-muted-foreground">{SOURCE_HINT[methodSource]}</p>
        ) : null}
      </div>

      {method ? (
        <DynamicMethodFields
          method={method}
          values={values}
          onFieldChange={setField}
          gatewayName={gatewayName}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Collected by</span>
        <span className="font-medium">{collectedByName || '—'}</span>
      </div>
    </div>
  );
}

function DynamicMethodFields({
  method,
  values,
  onFieldChange,
  gatewayName = 'payment gateway',
}: {
  method: DeskPaymentMethodDef;
  values: DeskPaymentFormValues;
  onFieldChange: (key: string, value: string) => void;
  gatewayName?: string;
}) {
  if (method.usesPaymentRequest) {
    return (
      <p className="text-sm text-muted-foreground">
        Use <strong>Open {gatewayName} checkout</strong> below — UPI, card, or net banking. Receipt
        is issued automatically when payment succeeds.
      </p>
    );
  }

  if (!method.fields.length) return null;

  return (
    <div className="space-y-3">
      {method.id === 'sbi_icollect' ? (
        <p className="text-xs text-muted-foreground">
          Provide <strong>either</strong> SBI Transaction ID <strong>or</strong> Bank Reference
          Number (at least one).
        </p>
      ) : null}
      {method.fields.map((field) => {
        const id = `desk-field-${field.key}`;
        if (field.type === 'textarea') {
          return (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={id}>
                {field.label}
                {field.required ? ' *' : ''}
              </Label>
              <textarea
                id={id}
                className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
              />
            </div>
          );
        }
        if (field.type === 'file') {
          return (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  onFieldChange(field.key, file ? file.name : '');
                }}
              />
              {values[field.key] ? (
                <p className="text-xs text-muted-foreground">Selected: {values[field.key]}</p>
              ) : null}
            </div>
          );
        }
        return (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={id}>
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            <Input
              id={id}
              type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
            />
          </div>
        );
      })}
      {method.pendingClearance ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
          Cheque payments are recorded as <strong>Pending Clearance</strong>. Fees are marked paid
          only after accounts clears the cheque.
        </p>
      ) : null}
    </div>
  );
}
