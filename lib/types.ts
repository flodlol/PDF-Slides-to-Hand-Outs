export type Orientation = "portrait" | "landscape";

export type PagesPerSheet = 1 | 2 | 3 | 4 | 6 | 9;

export interface HandoutSettings {
  pagesPerSheet: PagesPerSheet;
  orientation: Orientation;
  marginMm: number; // outer margins in millimeters
  spacingMm: number; // spacing between items in millimeters
  showFrame: boolean;
  showPageNumbers: boolean;
  showSlideNumbers: boolean;
  scale: number; // 80-100 percent
  notesEnabled: boolean;
  notesLineCount: number;
  notesLineSpacingMm: number;
  notesPosition: "bottom" | "left" | "right";
}

export interface TemplatePreset {
  id: string;
  name: string;
  description?: string;
  settings: HandoutSettings;
}

export interface LayoutSlot {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface SlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutPlan {
  pageWidthMm: number;
  pageHeightMm: number;
  slots: LayoutSlot[];
}

export interface LayoutPlanWithUnits extends LayoutPlan {
  slotsPt: SlotBox[];
  slotsPx: SlotBox[];
  pageWidthPt: number;
  pageHeightPt: number;
  pageWidthPx: number;
  pageHeightPx: number;
}
