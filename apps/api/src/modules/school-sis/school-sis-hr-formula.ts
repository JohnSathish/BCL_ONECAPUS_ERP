/** Money in paise (bigint). Ratios use n/d. No JS float in the money path. */

export type FormulaVars = Record<string, bigint>;

type Tok =
  | { t: 'num'; n: bigint; d: bigint }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    const x = a % b;
    a = b;
    b = x;
  }
  return a || 1n;
}

function rat(n: bigint, d: bigint = 1n): { n: bigint; d: bigint } {
  if (d === 0n) throw new Error('Division by zero in salary formula');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

function tokenize(src: string): Tok[] {
  const s = src.toUpperCase().replace(/\s+/g, '');
  if (!s) throw new Error('Empty formula');
  if (!/^[A-Z0-9_+\-*/().]+$/.test(s)) {
    throw new Error('Formula contains unsupported characters');
  }
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if ('+-*/()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i += 1;
      continue;
    }
    if (/[A-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[A-Z0-9_]/.test(s[j])) j += 1;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      let dots = c === '.' ? 1 : 0;
      while (j < s.length && /[0-9.]/.test(s[j])) {
        if (s[j] === '.') dots += 1;
        j += 1;
      }
      if (dots > 1) throw new Error('Invalid number in formula');
      const raw = s.slice(i, j);
      if (raw === '.') throw new Error('Invalid number in formula');
      if (raw.includes('.')) {
        const [a, b] = raw.split('.');
        const d = 10n ** BigInt(b.length);
        out.push({ t: 'num', n: BigInt(a || '0') * d + BigInt(b || '0'), d });
      } else {
        // Integer literals are rupees → paise
        out.push({ t: 'num', n: BigInt(raw) * 100n, d: 1n });
      }
      i = j;
      continue;
    }
    throw new Error('Invalid formula token');
  }
  return out;
}

export function evaluateFormulaPaise(expr: string, vars: FormulaVars): bigint {
  const tokens = tokenize(expr);
  let p = 0;
  const peek = () => tokens[p];
  const eat = () => tokens[p++];

  function parsePrimary(): { n: bigint; d: bigint } {
    const tok = eat();
    if (!tok) throw new Error('Unexpected end of formula');
    if (tok.t === 'num') return rat(tok.n, tok.d);
    if (tok.t === 'id') {
      if (!(tok.v in vars)) throw new Error(`Unknown formula field ${tok.v}`);
      return rat(vars[tok.v], 1n);
    }
    if (tok.t === 'op' && tok.v === '(') {
      const inner = parseExpr();
      const close = eat();
      if (!close || close.t !== 'op' || close.v !== ')')
        throw new Error('Missing )');
      return inner;
    }
    if (tok.t === 'op' && tok.v === '-') {
      const v = parsePrimary();
      return rat(-v.n, v.d);
    }
    throw new Error('Invalid formula');
  }

  function parseMul(): { n: bigint; d: bigint } {
    let left = parsePrimary();
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = eat().v;
      const right = parsePrimary();
      left =
        op === '*'
          ? rat(left.n * right.n, left.d * right.d)
          : rat(left.n * right.d, left.d * right.n);
    }
    return left;
  }

  function parseExpr(): { n: bigint; d: bigint } {
    let left = parseMul();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = eat().v;
      const right = parseMul();
      const d = left.d * right.d;
      const n =
        op === '+'
          ? left.n * right.d + right.n * left.d
          : left.n * right.d - right.n * left.d;
      left = rat(n, d);
    }
    return left;
  }

  const v = parseExpr();
  if (p !== tokens.length) throw new Error('Unexpected formula token');
  // Round half away from zero to paise
  const q = v.n / v.d;
  const rem = v.n % v.d;
  if (rem === 0n) return q;
  if (v.n >= 0n) return rem * 2n >= v.d ? q + 1n : q;
  return -rem * 2n >= v.d ? q - 1n : q;
}

export function rupeesToPaise(value: string | number): bigint {
  const s = String(value).trim();
  if (!s) return 0n;
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  const [a, b = ''] = raw.split('.');
  const frac = (b + '00').slice(0, 2);
  const p = BigInt(a || '0') * 100n + BigInt(frac);
  return neg ? -p : p;
}

export function paiseToRupees(p: bigint | number): string {
  const n = typeof p === 'number' ? BigInt(Math.trunc(p)) : p;
  const neg = n < 0n;
  const a = neg ? -n : n;
  const rupees = a / 100n;
  const paise = a % 100n;
  const out = `${rupees}.${paise.toString().padStart(2, '0')}`;
  return neg ? `-${out}` : out;
}

export function formatInrPaise(p: bigint | number): string {
  const n = Number(paiseToRupees(p));
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function maskAccount(full: string) {
  const digits = full.replace(/\s+/g, '');
  if (digits.length < 4) return 'XXXX';
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function maskPan(pan: string) {
  if (!pan || pan.length < 4) return 'XXXX';
  return `${pan.slice(0, 2)}XXXX${pan.slice(-2)}`;
}
