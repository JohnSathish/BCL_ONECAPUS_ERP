import type { IdCardFieldKey, IdCardElementStyle } from '@/types/id-card-template';

export function layoutEl(
  fieldKey: IdCardFieldKey,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex = 1,
  align: 'left' | 'center' | 'right' = 'left',
  style?: Partial<IdCardElementStyle>,
) {
  return {
    id: fieldKey,
    type: 'field' as const,
    fieldKey,
    x,
    y,
    width,
    height,
    zIndex,
    style: { visible: true, align, ...style },
  };
}
