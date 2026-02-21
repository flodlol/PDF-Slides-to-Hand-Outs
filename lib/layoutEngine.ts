import { HandoutSettings, LayoutPlanWithUnits, SlotBox, PagesPerSheet } from "./types";

const MM_TO_PT = 72 / 25.4;
const MM_TO_PX = 3.7795275591; // assuming 96 DPI for preview canvas
const A4_PORTRAIT = { width: 210, height: 297 };

export const mmToPt = (mm: number) => mm * MM_TO_PT;
export const mmToPx = (mm: number) => Math.round(mm * MM_TO_PX);

function getGrid(pagesPerSheet: PagesPerSheet, orientation: HandoutSettings["orientation"]) {
  switch (pagesPerSheet) {
    case 1:
      return { rows: 1, cols: 1 };
    case 2:
      return orientation === "portrait" ? { rows: 2, cols: 1 } : { rows: 1, cols: 2 };
    case 4:
      return { rows: 2, cols: 2 };
    case 6:
      return orientation === "portrait" ? { rows: 3, cols: 2 } : { rows: 2, cols: 3 };
    case 9:
    default:
      return { rows: 3, cols: 3 };
  }
}

function buildSlots(
  rows: number,
  cols: number,
  pageWidthMm: number,
  pageHeightMm: number,
  marginMm: number,
  spacingMm: number
) {
  const usableWidth = pageWidthMm - marginMm * 2 - spacingMm * (cols - 1);
  const usableHeight = pageHeightMm - marginMm * 2 - spacingMm * (rows - 1);

  const slotWidth = usableWidth / cols;
  const slotHeight = usableHeight / rows;

  const slots = [] as { xMm: number; yMm: number; widthMm: number; heightMm: number }[];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xMm = marginMm + c * (slotWidth + spacingMm);
      const yMm = marginMm + r * (slotHeight + spacingMm);
      slots.push({ xMm, yMm, widthMm: slotWidth, heightMm: slotHeight });
    }
  }
  return slots;
}

export function buildLayoutPlan(settings: HandoutSettings): LayoutPlanWithUnits {
  const { orientation, marginMm, spacingMm, pagesPerSheet } = settings;

  const base = orientation === "portrait" ? A4_PORTRAIT : { width: A4_PORTRAIT.height, height: A4_PORTRAIT.width };
  const grid = getGrid(pagesPerSheet, orientation);
  const slots = buildSlots(grid.rows, grid.cols, base.width, base.height, marginMm, spacingMm);

  const toSlotBox = (fn: (value: number) => number): SlotBox[] =>
    slots.map((slot) => ({
      x: fn(slot.xMm),
      y: fn(slot.yMm),
      width: fn(slot.widthMm),
      height: fn(slot.heightMm),
    }));

  const slotsPt = toSlotBox(mmToPt);
  const slotsPx = toSlotBox(mmToPx);

  return {
    pageWidthMm: base.width,
    pageHeightMm: base.height,
    slots,
    slotsPt,
    slotsPx,
    pageWidthPt: mmToPt(base.width),
    pageHeightPt: mmToPt(base.height),
    pageWidthPx: mmToPx(base.width),
    pageHeightPx: mmToPx(base.height),
  };
}
