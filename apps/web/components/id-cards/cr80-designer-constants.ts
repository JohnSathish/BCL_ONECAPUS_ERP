import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';

export const MM_TO_PX = 96 / 25.4;

export const CR80_SAFE_MARGIN_MM = 3;
export const CR80_BLEED_MM = 3;
export const CR80_GRID_MM = 1;

export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
export type ZoomPreset = (typeof ZOOM_PRESETS)[number] | 'fit';

export const TEMPLATE_CATEGORIES = [
  { id: 'STUDENT', label: 'Student' },
  { id: 'STAFF', label: 'Staff' },
  { id: 'LIBRARY', label: 'Library' },
  { id: 'VISITOR', label: 'Visitor' },
  { id: 'TEMPORARY', label: 'Temporary Pass' },
  { id: 'ALUMNI', label: 'Alumni' },
] as const;

export type DesignerViewMode = 'front' | 'back' | 'both';

export type PrintCalibration = {
  topOffsetMm: number;
  leftOffsetMm: number;
  rightOffsetMm: number;
  bottomOffsetMm: number;
};

/** Evolis Primacy driver feed compensation — never applied to design preview. */
export type EvolisFeedOptions = {
  rotateFront180?: boolean;
  rotateBack180?: boolean;
};

export const DEFAULT_PRINT_CALIBRATION: PrintCalibration = {
  topOffsetMm: 0,
  leftOffsetMm: 0,
  rightOffsetMm: 0,
  bottomOffsetMm: 0,
};

export const DEFAULT_EVOLIS_FEED: EvolisFeedOptions = {
  rotateFront180: false,
  rotateBack180: false,
};

export function mmToScreenPx(mm: number, zoom: number) {
  return mm * MM_TO_PX * zoom;
}

export function screenPxToMm(px: number, zoom: number) {
  return px / (MM_TO_PX * zoom);
}

export function snapMm(value: number, gridMm: number, enabled: boolean) {
  if (!enabled || gridMm <= 0) return value;
  return Math.round(value / gridMm) * gridMm;
}

export function cardCanvasSizePx(zoom: number) {
  return {
    width: mmToScreenPx(CR80_WIDTH_MM, zoom),
    height: mmToScreenPx(CR80_HEIGHT_MM, zoom),
  };
}
