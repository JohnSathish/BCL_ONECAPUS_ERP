import { BadRequestException, Injectable } from '@nestjs/common';

export type FormulaNode = {
  op: string;
  value?: number;
  base?: string;
  rate?: number;
  round?: string;
  args?: FormulaNode[];
  ref?: string;
};

export type FormulaContext = Record<string, number>;

export type ComponentOverride = {
  rate?: number;
  value?: number;
  /** When true, component amount is forced to zero (e.g. PF exempt staff). */
  disabled?: boolean;
};

export function applyComponentOverride(
  node: FormulaNode,
  override?: ComponentOverride,
): FormulaNode {
  if (!override) return node;
  if (override.disabled) {
    return { op: 'FIXED', value: 0, round: 'NEAREST_RUPEE' };
  }
  if (override.value != null) {
    return {
      op: 'FIXED',
      value: override.value,
      round: node.round ?? 'NEAREST_RUPEE',
    };
  }
  const op = node.op?.toUpperCase();
  if (op === 'PERCENT_OF' && override.rate != null) {
    return { ...node, rate: override.rate };
  }
  if (op === 'FIXED' && override.value != null) {
    return { ...node, value: override.value };
  }
  if (node.args?.length) {
    return {
      ...node,
      args: node.args.map((arg) => applyComponentOverride(arg, override)),
    };
  }
  return node;
}

function normalizeOverrides(
  overrides?: Record<string, ComponentOverride> | null,
): Map<string, ComponentOverride> {
  const map = new Map<string, ComponentOverride>();
  if (!overrides || typeof overrides !== 'object') return map;
  for (const [key, value] of Object.entries(overrides)) {
    if (!value || typeof value !== 'object') continue;
    map.set(key.toUpperCase(), value);
  }
  return map;
}

@Injectable()
export class FormulaEngineService {
  roundAmount(value: number, mode?: string): number {
    if (mode === 'NEAREST_RUPEE') return Math.round(value);
    if (mode === 'FLOOR') return Math.floor(value);
    if (mode === 'CEIL') return Math.ceil(value);
    return Math.round(value * 100) / 100;
  }

  evaluate(
    node: FormulaNode,
    context: FormulaContext,
  ): { amount: number; trace: FormulaNode } {
    const op = node.op?.toUpperCase();
    switch (op) {
      case 'FIXED':
        return {
          amount: this.roundAmount(node.value ?? 0, node.round),
          trace: node,
        };
      case 'PERCENT_OF': {
        const baseKey = (node.base ?? 'BASIC').toUpperCase();
        const baseVal = context[baseKey] ?? 0;
        const amount = this.roundAmount(
          (baseVal * (node.rate ?? 0)) / 100,
          node.round,
        );
        return {
          amount,
          trace: { ...node, computedBase: baseVal } as FormulaNode,
        };
      }
      case 'REFERENCE': {
        const refKey = (node.ref ?? '').toUpperCase();
        const amount = context[refKey] ?? 0;
        return { amount, trace: node };
      }
      case 'SUM': {
        const args = node.args ?? [];
        const amount = args.reduce(
          (sum, arg) => sum + this.evaluate(arg, context).amount,
          0,
        );
        return { amount: this.roundAmount(amount, node.round), trace: node };
      }
      case 'SUBTRACT': {
        const args = node.args ?? [];
        if (args.length < 2) return { amount: 0, trace: node };
        const first = this.evaluate(args[0], context).amount;
        const rest = args
          .slice(1)
          .reduce((sum, arg) => sum + this.evaluate(arg, context).amount, 0);
        return {
          amount: this.roundAmount(first - rest, node.round),
          trace: node,
        };
      }
      case 'MIN': {
        const args = node.args ?? [];
        const amounts = args.map((a) => this.evaluate(a, context).amount);
        return { amount: Math.min(...amounts), trace: node };
      }
      case 'MAX': {
        const args = node.args ?? [];
        const amounts = args.map((a) => this.evaluate(a, context).amount);
        return { amount: Math.max(...amounts), trace: node };
      }
      case 'PRORATE': {
        const inner = node.args?.[0];
        if (!inner) return { amount: 0, trace: node };
        const raw = this.evaluate(inner, context).amount;
        const factor = context.PRORATION_FACTOR ?? 1;
        return {
          amount: this.roundAmount(raw * factor, node.round),
          trace: node,
        };
      }
      case 'LOAN_DEDUCTION':
        return { amount: context.LOAN_DEDUCTION ?? 0, trace: node };
      case 'ASSIGNED_BASIC':
        return {
          amount: this.roundAmount(context.BASIC ?? 0, node.round),
          trace: node,
        };
      default:
        throw new BadRequestException(`Unknown formula op: ${node.op}`);
    }
  }

  validateFormula(node: FormulaNode, knownCodes: Set<string>): void {
    const op = node.op?.toUpperCase();
    if (op === 'PERCENT_OF' && node.base) {
      const base = node.base.toUpperCase();
      if (base !== 'BASIC' && !knownCodes.has(base)) {
        throw new BadRequestException(`Unknown base component: ${node.base}`);
      }
    }
    if (op === 'REFERENCE' && node.ref) {
      if (!knownCodes.has(node.ref.toUpperCase())) {
        throw new BadRequestException(
          `Unknown reference component: ${node.ref}`,
        );
      }
    }
    for (const arg of node.args ?? []) {
      this.validateFormula(arg, knownCodes);
    }
  }

  detectCircularDependencies(
    components: Array<{ code: string; formulaJson: FormulaNode }>,
  ): void {
    const graph = new Map<string, string[]>();
    for (const c of components) {
      graph.set(c.code.toUpperCase(), this.extractRefs(c.formulaJson));
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const dfs = (code: string) => {
      if (visiting.has(code)) {
        throw new BadRequestException(
          `Circular formula dependency detected at ${code}`,
        );
      }
      if (visited.has(code)) return;
      visiting.add(code);
      for (const dep of graph.get(code) ?? []) {
        if (graph.has(dep)) dfs(dep);
      }
      visiting.delete(code);
      visited.add(code);
    };
    for (const code of graph.keys()) dfs(code);
  }

  private extractRefs(node: FormulaNode): string[] {
    const refs: string[] = [];
    if (node.op?.toUpperCase() === 'REFERENCE' && node.ref)
      refs.push(node.ref.toUpperCase());
    if (
      node.op?.toUpperCase() === 'PERCENT_OF' &&
      node.base &&
      node.base.toUpperCase() !== 'BASIC'
    ) {
      refs.push(node.base.toUpperCase());
    }
    for (const arg of node.args ?? []) refs.push(...this.extractRefs(arg));
    return refs;
  }

  topologicalSort(
    components: Array<{ code: string; formulaJson: FormulaNode }>,
  ): string[] {
    const codes = components.map((c) => c.code.toUpperCase());
    const known = new Set(codes);
    this.detectCircularDependencies(components);
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const code of codes) {
      inDegree.set(code, 0);
      adj.set(code, []);
    }
    for (const c of components) {
      const code = c.code.toUpperCase();
      const deps = this.extractRefs(c.formulaJson).filter((d) => known.has(d));
      for (const dep of deps) {
        adj.get(dep)!.push(code);
        inDegree.set(code, (inDegree.get(code) ?? 0) + 1);
      }
    }
    const queue = codes.filter((c) => (inDegree.get(c) ?? 0) === 0);
    const sorted: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      sorted.push(cur);
      for (const next of adj.get(cur) ?? []) {
        inDegree.set(next, (inDegree.get(next) ?? 1) - 1);
        if (inDegree.get(next) === 0) queue.push(next);
      }
    }
    if (sorted.length !== codes.length) {
      throw new BadRequestException(
        'Unable to resolve component evaluation order',
      );
    }
    return sorted;
  }

  computeAll(
    components: Array<{
      code: string;
      name: string;
      componentType: string;
      formulaJson: FormulaNode;
    }>,
    basicPay: number,
    extraContext: FormulaContext = {},
    componentOverrides?: Record<string, ComponentOverride> | null,
  ): Array<{
    code: string;
    name: string;
    componentType: string;
    amount: number;
    formulaTrace: FormulaNode;
  }> {
    const context: FormulaContext = { BASIC: basicPay, ...extraContext };
    const order = this.topologicalSort(components);
    const byCode = new Map(components.map((c) => [c.code.toUpperCase(), c]));
    const overrides = normalizeOverrides(componentOverrides);
    const results: Array<{
      code: string;
      name: string;
      componentType: string;
      amount: number;
      formulaTrace: FormulaNode;
    }> = [];

    for (const code of order) {
      const comp = byCode.get(code)!;
      const override = overrides.get(comp.code.toUpperCase());
      const formulaJson = applyComponentOverride(comp.formulaJson, override);
      const { amount, trace } = this.evaluate(formulaJson, context);
      context[code] = amount;
      results.push({
        code: comp.code,
        name: comp.name,
        componentType: comp.componentType,
        amount,
        formulaTrace: trace,
      });
    }
    return results;
  }
}
