'use client';

import { useEffect, useState } from 'react';

export type FormulaNode = {
  op: string;
  value?: number;
  base?: string;
  rate?: number;
  round?: string;
  ref?: string;
  args?: FormulaNode[];
};

type FormulaKind =
  | 'FIXED'
  | 'PERCENT_BASIC'
  | 'PERCENT_COMPONENT'
  | 'REFERENCE'
  | 'LOAN_DEDUCTION'
  | 'ASSIGNED_BASIC'
  | 'PRORATE';

function detectKind(node: FormulaNode): FormulaKind {
  const op = node.op?.toUpperCase();
  if (op === 'FIXED') return 'FIXED';
  if (op === 'PERCENT_OF' && (node.base ?? 'BASIC').toUpperCase() === 'BASIC')
    return 'PERCENT_BASIC';
  if (op === 'PERCENT_OF') return 'PERCENT_COMPONENT';
  if (op === 'REFERENCE') return 'REFERENCE';
  if (op === 'LOAN_DEDUCTION') return 'LOAN_DEDUCTION';
  if (op === 'ASSIGNED_BASIC') return 'ASSIGNED_BASIC';
  if (op === 'PRORATE') return 'PRORATE';
  return 'FIXED';
}

function buildNode(
  kind: FormulaKind,
  params: { value?: number; rate?: number; base?: string; ref?: string; inner?: FormulaNode },
): FormulaNode {
  switch (kind) {
    case 'FIXED':
      return { op: 'FIXED', value: params.value ?? 0, round: 'NEAREST_RUPEE' };
    case 'PERCENT_BASIC':
      return { op: 'PERCENT_OF', base: 'BASIC', rate: params.rate ?? 0, round: 'NEAREST_RUPEE' };
    case 'PERCENT_COMPONENT':
      return {
        op: 'PERCENT_OF',
        base: params.base ?? 'BASIC',
        rate: params.rate ?? 0,
        round: 'NEAREST_RUPEE',
      };
    case 'REFERENCE':
      return { op: 'REFERENCE', ref: params.ref ?? 'BASIC' };
    case 'LOAN_DEDUCTION':
      return { op: 'LOAN_DEDUCTION' };
    case 'ASSIGNED_BASIC':
      return { op: 'ASSIGNED_BASIC', round: 'NEAREST_RUPEE' };
    case 'PRORATE':
      return {
        op: 'PRORATE',
        args: [params.inner ?? { op: 'REFERENCE', ref: 'BASIC' }],
        round: 'NEAREST_RUPEE',
      };
    default:
      return { op: 'FIXED', value: 0, round: 'NEAREST_RUPEE' };
  }
}

export function FormulaBuilder({
  value,
  onChange,
  componentCodes = [],
  showAdvanced = false,
}: {
  value: FormulaNode;
  onChange: (node: FormulaNode) => void;
  componentCodes?: string[];
  showAdvanced?: boolean;
}) {
  const [kind, setKind] = useState<FormulaKind>(() => detectKind(value));
  const [fixedValue, setFixedValue] = useState(value.value ?? 0);
  const [rate, setRate] = useState(value.rate ?? 0);
  const [base, setBase] = useState(value.base ?? 'BASIC');
  const [ref, setRef] = useState(value.ref ?? 'BASIC');
  const [advancedJson, setAdvancedJson] = useState(JSON.stringify(value, null, 2));
  const [advancedMode, setAdvancedMode] = useState(showAdvanced);

  useEffect(() => {
    setKind(detectKind(value));
    setFixedValue(value.value ?? 0);
    setRate(value.rate ?? 0);
    setBase(value.base ?? 'BASIC');
    setRef(value.ref ?? 'BASIC');
    setAdvancedJson(JSON.stringify(value, null, 2));
  }, [value]);

  const emit = (nextKind: FormulaKind) => {
    const node = buildNode(nextKind, {
      value: fixedValue,
      rate,
      base,
      ref,
      inner: value.args?.[0],
    });
    onChange(node);
  };

  const onKindChange = (next: FormulaKind) => {
    setKind(next);
    emit(next);
  };

  if (advancedMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Advanced JSON</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setAdvancedMode(false)}
          >
            Visual builder
          </button>
        </div>
        <textarea
          className="w-full rounded border px-2 py-1 font-mono text-[11px]"
          rows={4}
          value={advancedJson}
          onChange={(e) => {
            setAdvancedJson(e.target.value);
            try {
              onChange(JSON.parse(e.target.value) as FormulaNode);
            } catch {
              // wait for valid JSON
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <select
          className="w-full rounded border px-2 py-1 text-xs"
          value={kind}
          onChange={(e) => onKindChange(e.target.value as FormulaKind)}
        >
          <option value="FIXED">Fixed amount ₹</option>
          <option value="PERCENT_BASIC">% of Basic Pay</option>
          <option value="PERCENT_COMPONENT">% of another component</option>
          <option value="REFERENCE">Copy component value</option>
          <option value="ASSIGNED_BASIC">Assigned Basic Pay</option>
          <option value="LOAN_DEDUCTION">Active loan deduction</option>
          <option value="PRORATE">Prorate (attendance)</option>
        </select>
        <button
          type="button"
          className="shrink-0 text-xs text-primary hover:underline"
          onClick={() => setAdvancedMode(true)}
        >
          JSON
        </button>
      </div>

      {kind === 'FIXED' && (
        <input
          type="number"
          className="w-full rounded border px-2 py-1 text-xs"
          value={fixedValue}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFixedValue(v);
            onChange(buildNode('FIXED', { value: v }));
          }}
          placeholder="Amount in ₹"
        />
      )}

      {(kind === 'PERCENT_BASIC' || kind === 'PERCENT_COMPONENT') && (
        <div className="flex gap-2">
          <input
            type="number"
            className="w-full rounded border px-2 py-1 text-xs"
            value={rate}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRate(v);
              onChange(buildNode(kind, { rate: v, base }));
            }}
            placeholder="Rate %"
          />
          {kind === 'PERCENT_COMPONENT' && (
            <select
              className="w-full rounded border px-2 py-1 text-xs"
              value={base}
              onChange={(e) => {
                setBase(e.target.value);
                onChange(buildNode(kind, { rate, base: e.target.value }));
              }}
            >
              {componentCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {kind === 'REFERENCE' && (
        <select
          className="w-full rounded border px-2 py-1 text-xs"
          value={ref}
          onChange={(e) => {
            setRef(e.target.value);
            onChange(buildNode('REFERENCE', { ref: e.target.value }));
          }}
        >
          {componentCodes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {(kind === 'LOAN_DEDUCTION' || kind === 'ASSIGNED_BASIC' || kind === 'PRORATE') && (
        <p className="text-[11px] text-muted-foreground">
          {kind === 'LOAN_DEDUCTION' &&
            'Uses active loan EMI from the Loans module during payroll calculation.'}
          {kind === 'ASSIGNED_BASIC' && "Uses the staff member's assigned basic pay."}
          {kind === 'PRORATE' && 'Applies attendance proration factor to basic pay reference.'}
        </p>
      )}
    </div>
  );
}

export function parseFormulaJson(raw: string): FormulaNode {
  return JSON.parse(raw) as FormulaNode;
}

export function stringifyFormula(node: FormulaNode): string {
  return JSON.stringify(node, null, 2);
}
