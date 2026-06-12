'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function Cr80Barcode({ value, className }: { value: string; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 1.2,
        height: 36,
        displayValue: true,
        fontSize: 10,
        margin: 0,
        background: 'transparent',
        lineColor: '#1e293b',
      });
    } catch {
      /* invalid barcode value */
    }
  }, [value]);

  if (!value) return null;

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
}
