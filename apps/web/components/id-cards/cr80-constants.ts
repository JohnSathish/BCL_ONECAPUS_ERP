/** ISO/IEC 7810 ID-1 (CR80) physical card — 85.6 × 53.98 mm */
export const CR80_PHYSICAL_WIDTH_MM = 85.6;
export const CR80_PHYSICAL_HEIGHT_MM = 53.98;

/** Evolis Primacy portrait feed: short edge horizontal, long edge vertical */
export const CR80_WIDTH_MM = CR80_PHYSICAL_HEIGHT_MM;
export const CR80_HEIGHT_MM = CR80_PHYSICAL_WIDTH_MM;

/** Evolis Primacy default print resolution */
export const CR80_DPI = 300;

export const CR80_WIDTH_PX = Math.round((CR80_WIDTH_MM / 25.4) * CR80_DPI);
export const CR80_HEIGHT_PX = Math.round((CR80_HEIGHT_MM / 25.4) * CR80_DPI);

/** Screen preview scale (portrait card is tall on screen) */
export const CR80_PREVIEW_SCALE = 0.55;
