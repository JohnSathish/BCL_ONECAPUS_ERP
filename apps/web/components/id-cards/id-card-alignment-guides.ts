import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';

export const ID_CARD_SAFE_MARGIN_MM = 3;
const GUIDE_THRESHOLD_MM = 0.6;

export type GuideBox = { x: number; y: number; width: number; height: number };

export type AlignmentGuideLine = {
  orientation: 'v' | 'h';
  /** Position in mm from left (v) or top (h) */
  position: number;
};

export type AlignmentSnapResult = {
  x: number;
  y: number;
  guides: AlignmentGuideLine[];
};

function uniqueGuides(guides: AlignmentGuideLine[]): AlignmentGuideLine[] {
  const seen = new Set<string>();
  return guides.filter((g) => {
    const key = `${g.orientation}:${g.position.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Snap dragging box to sibling edges/centers, card center, and 3mm safe margin.
 */
export function snapToAlignmentGuides(
  box: GuideBox,
  siblings: GuideBox[],
  thresholdMm = GUIDE_THRESHOLD_MM,
): AlignmentSnapResult {
  const left = box.x;
  const right = box.x + box.width;
  const cx = box.x + box.width / 2;
  const top = box.y;
  const bottom = box.y + box.height;
  const cy = box.y + box.height / 2;

  const xTargets: number[] = [
    ID_CARD_SAFE_MARGIN_MM,
    CR80_WIDTH_MM - ID_CARD_SAFE_MARGIN_MM,
    CR80_WIDTH_MM / 2,
  ];
  const yTargets: number[] = [
    ID_CARD_SAFE_MARGIN_MM,
    CR80_HEIGHT_MM - ID_CARD_SAFE_MARGIN_MM,
    CR80_HEIGHT_MM / 2,
  ];

  for (const s of siblings) {
    xTargets.push(s.x, s.x + s.width, s.x + s.width / 2);
    yTargets.push(s.y, s.y + s.height, s.y + s.height / 2);
  }

  let bestDx = 0;
  let bestDy = 0;
  let bestAbsDx = thresholdMm + 1;
  let bestAbsDy = thresholdMm + 1;
  const guides: AlignmentGuideLine[] = [];

  const tryX = (edge: number, target: number) => {
    const d = target - edge;
    const a = Math.abs(d);
    if (a <= thresholdMm && a < bestAbsDx) {
      bestAbsDx = a;
      bestDx = d;
    }
  };
  const tryY = (edge: number, target: number) => {
    const d = target - edge;
    const a = Math.abs(d);
    if (a <= thresholdMm && a < bestAbsDy) {
      bestAbsDy = a;
      bestDy = d;
    }
  };

  for (const t of xTargets) {
    tryX(left, t);
    tryX(right, t);
    tryX(cx, t);
  }
  for (const t of yTargets) {
    tryY(top, t);
    tryY(bottom, t);
    tryY(cy, t);
  }

  const x = box.x + (bestAbsDx <= thresholdMm ? bestDx : 0);
  const y = box.y + (bestAbsDy <= thresholdMm ? bestDy : 0);

  if (bestAbsDx <= thresholdMm) {
    const snappedLeft = x;
    const snappedRight = x + box.width;
    const snappedCx = x + box.width / 2;
    for (const t of xTargets) {
      if (
        Math.abs(snappedLeft - t) < 0.05 ||
        Math.abs(snappedRight - t) < 0.05 ||
        Math.abs(snappedCx - t) < 0.05
      ) {
        guides.push({ orientation: 'v', position: t });
      }
    }
  }
  if (bestAbsDy <= thresholdMm) {
    const snappedTop = y;
    const snappedBottom = y + box.height;
    const snappedCy = y + box.height / 2;
    for (const t of yTargets) {
      if (
        Math.abs(snappedTop - t) < 0.05 ||
        Math.abs(snappedBottom - t) < 0.05 ||
        Math.abs(snappedCy - t) < 0.05
      ) {
        guides.push({ orientation: 'h', position: t });
      }
    }
  }

  return { x, y, guides: uniqueGuides(guides) };
}
