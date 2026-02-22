import { HandoutSettings, PagesPerSheet } from "./types";

export type SlideSettingsOverrideMap = Record<number, HandoutSettings>;

export interface OutputPagePlan {
  settings: HandoutSettings;
  pageIndices: number[];
}

export function buildOutputPlan(
  orderedPages: number[],
  globalSettings: HandoutSettings,
  overrides: SlideSettingsOverrideMap = {}
): OutputPagePlan[] {
  if (!orderedPages || orderedPages.length === 0) return [];

  const plan: OutputPagePlan[] = [];
  let current: OutputPagePlan & { signature: string } | null = null;

  for (const pageIndex of orderedPages) {
    const effectiveSettings = overrides[pageIndex] ?? globalSettings;
    const signature = settingsSignature(effectiveSettings);
    if (!current || current.signature !== signature || current.pageIndices.length >= effectiveSettings.pagesPerSheet) {
      current = { settings: effectiveSettings, pageIndices: [], signature };
      plan.push(current);
    }
    current.pageIndices.push(pageIndex);
  }

  return plan.map(({ signature, ...rest }) => rest);
}

function settingsSignature(settings: HandoutSettings) {
  return JSON.stringify({
    pagesPerSheet: settings.pagesPerSheet,
    orientation: settings.orientation,
    marginMm: settings.marginMm,
    spacingMm: settings.spacingMm,
    scale: settings.scale,
    showFrame: settings.showFrame,
    showPageNumbers: settings.showPageNumbers,
    showSlideNumbers: settings.showSlideNumbers,
    notesEnabled: settings.notesEnabled,
    notesLineCount: settings.notesLineCount,
    notesLineSpacingMm: settings.notesLineSpacingMm,
    notesPosition: settings.notesPosition,
  });
}
