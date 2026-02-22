import { HandoutSettings } from "./types";

export interface NotesLayout {
  enabled: boolean;
  position: "bottom" | "left" | "right";
  lineCount: number;
  lineSpacingMm: number;
  notesAreaMm: number;
  notesAreaWidthMm: number;
  notesAreaHeightMm: number;
  gapMm: number;
}

export function getNotesLayout(
  slotWidthMm: number,
  slotHeightMm: number,
  settings: HandoutSettings
): NotesLayout {
  if (!settings.notesEnabled) {
    return {
      enabled: false,
      position: "bottom",
      lineCount: 0,
      lineSpacingMm: 0,
      notesAreaMm: 0,
      notesAreaWidthMm: 0,
      notesAreaHeightMm: 0,
      gapMm: 0,
    };
  }

  const requestedLines = Math.max(1, Math.round(settings.notesLineCount));
  const spacing = Math.max(2, settings.notesLineSpacingMm);
  const maxNotesAreaMm = slotHeightMm * 0.45;
  const maxLines = Math.max(1, Math.floor(maxNotesAreaMm / spacing));
  const lineCount = Math.min(requestedLines, maxLines);
  const notesAreaMm = lineCount * spacing;
  const gapMm = Math.min(4, spacing * 0.5);
  const position = settings.notesPosition ?? "bottom";
  const sideWidth = Math.min(slotWidthMm * 0.38, 55);
  const notesAreaWidthMm = position === "bottom" ? 0 : sideWidth;
  const notesAreaHeightMm = position === "bottom" ? notesAreaMm : 0;

  return {
    enabled: true,
    position,
    lineCount,
    lineSpacingMm: spacing,
    notesAreaMm,
    notesAreaWidthMm,
    notesAreaHeightMm,
    gapMm,
  };
}
