import { HandoutSettings, TemplatePreset } from "./types";

export const defaultSettings: HandoutSettings = {
  pagesPerSheet: 4,
  orientation: "landscape",
  marginMm: 8,
  spacingMm: 6,
  showFrame: true,
  showPageNumbers: true,
  showSlideNumbers: false,
  scale: 95,
  notesEnabled: false,
  notesLineCount: 6,
  notesLineSpacingMm: 6,
  notesPosition: "bottom",
};

export const templates: TemplatePreset[] = [
  {
    id: "2-clean",
    name: "2 Slides Clean",
    description: "Wide layout with generous margin and subtle frame.",
    settings: {
      pagesPerSheet: 2,
      orientation: "landscape",
      marginMm: 12,
      spacingMm: 8,
      showFrame: true,
      showPageNumbers: true,
      showSlideNumbers: true,
      scale: 96,
      notesEnabled: false,
      notesLineCount: 6,
      notesLineSpacingMm: 6,
      notesPosition: "bottom",
    },
  },
  {
    id: "4-compact",
    name: "4 Slides Compact",
    description: "Dense grid, thin spacing, ideal for study notes.",
    settings: {
      pagesPerSheet: 4,
      orientation: "landscape",
      marginMm: 8,
      spacingMm: 4,
      showFrame: false,
      showPageNumbers: true,
      showSlideNumbers: false,
      scale: 92,
      notesEnabled: false,
      notesLineCount: 6,
      notesLineSpacingMm: 6,
      notesPosition: "bottom",
    },
  },
  {
    id: "3-space",
    name: "3 Slides With Space",
    description: "Two columns plus breathing room for annotations.",
    settings: {
      pagesPerSheet: 6,
      orientation: "portrait",
      marginMm: 10,
      spacingMm: 10,
      showFrame: true,
      showPageNumbers: false,
      showSlideNumbers: true,
      scale: 90,
      notesEnabled: false,
      notesLineCount: 6,
      notesLineSpacingMm: 6,
      notesPosition: "bottom",
    },
  },
  {
    id: "minimal-margin",
    name: "Minimal Margin",
    description: "Edge-to-edge look with minimal borders.",
    settings: {
      pagesPerSheet: 2,
      orientation: "portrait",
      marginMm: 4,
      spacingMm: 4,
      showFrame: false,
      showPageNumbers: false,
      showSlideNumbers: false,
      scale: 98,
      notesEnabled: false,
      notesLineCount: 6,
      notesLineSpacingMm: 6,
      notesPosition: "bottom",
    },
  },
  {
    id: "exam-handout",
    name: "Exam Handout",
    description: "Large readable slides with numbering and frame.",
    settings: {
      pagesPerSheet: 1,
      orientation: "portrait",
      marginMm: 14,
      spacingMm: 8,
      showFrame: true,
      showPageNumbers: true,
      showSlideNumbers: true,
      scale: 100,
      notesEnabled: false,
      notesLineCount: 6,
      notesLineSpacingMm: 6,
      notesPosition: "bottom",
    },
  },
];

export function serializeTemplate(template: TemplatePreset) {
  return JSON.stringify(template, null, 2);
}

export function downloadTemplate(template: TemplatePreset) {
  if (typeof window === "undefined") return;
  const blob = new Blob([serializeTemplate(template)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${template.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
