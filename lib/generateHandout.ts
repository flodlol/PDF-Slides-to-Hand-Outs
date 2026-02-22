import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildLayoutPlan, mmToPt } from "./layoutEngine";
import { HandoutSettings } from "./types";
import { buildOutputPlan, SlideSettingsOverrideMap } from "./outputPlan";
import { getNotesLayout } from "./notesLayout";

/**
 * Generate an N-up handout PDF based on incoming PDF bytes and layout settings.
 */
export async function generateHandout(
  inputPdfBytes: Uint8Array,
  settings: HandoutSettings,
  selectedPages?: number[], // zero-based page indices to keep; defaults to all
  overrides: SlideSettingsOverrideMap = {}
): Promise<Uint8Array> {
  if (!inputPdfBytes || inputPdfBytes.length < 4) {
    throw new Error("Input PDF bytes are empty.");
  }

  const src = await PDFDocument.load(inputPdfBytes, { ignoreEncryption: true });
  const target = await PDFDocument.create();
  const font = await target.embedFont(StandardFonts.Helvetica);
  const pageIndices =
    selectedPages && selectedPages.length > 0
      ? selectedPages
      : Array.from({ length: src.getPageCount() }, (_, i) => i);
  const outputPlan = buildOutputPlan(pageIndices, settings, overrides);
  const outputPageCount = Math.max(1, outputPlan.length);

  let orderIndex = 0;
  for (let outIndex = 0; outIndex < outputPlan.length; outIndex++) {
    const plan = outputPlan[outIndex];
    const contentScale = plan.settings.scale / 100;
    const layout = buildLayoutPlan(plan.settings);
    const page = target.addPage([layout.pageWidthPt, layout.pageHeightPt]);

    for (let slotIndex = 0; slotIndex < plan.pageIndices.length; slotIndex++) {
      const inputIndex = plan.pageIndices[slotIndex];
      const sourcePage = src.getPage(inputIndex);
      const embedded = await target.embedPage(sourcePage);
      const slot = layout.slotsPt[slotIndex];
      const slotMm = layout.slots[slotIndex];
      const notes = getNotesLayout(slotMm.widthMm, slotMm.heightMm, plan.settings);
      const notesOffsetPt =
        notes.position === "bottom" ? mmToPt(notes.notesAreaMm + notes.gapMm) : 0;
      const sideOffsetPt =
        notes.position === "left" || notes.position === "right"
          ? mmToPt(notes.notesAreaWidthMm + notes.gapMm)
          : 0;
      const contentHeightPt = Math.max(8, slot.height - notesOffsetPt);
      const contentWidthPt = Math.max(8, slot.width - sideOffsetPt);

      const fit = Math.min(contentWidthPt / embedded.width, contentHeightPt / embedded.height);
      const renderScale = fit * contentScale;
      const renderWidth = embedded.width * renderScale;
      const renderHeight = embedded.height * renderScale;

      const x =
        notes.position === "left"
          ? slot.x + sideOffsetPt + (contentWidthPt - renderWidth) / 2
          : slot.x + (contentWidthPt - renderWidth) / 2;
      // PDF-lib's origin is bottom-left; convert from top-based slot y
      const slotBottom = layout.pageHeightPt - slot.y - slot.height;
      const contentBottom = slotBottom + notesOffsetPt;
      const y = contentBottom + (contentHeightPt - renderHeight) / 2;

      page.drawPage(embedded, {
        x,
        y,
        xScale: renderScale,
        yScale: renderScale,
      });

      if (plan.settings.showFrame) {
        page.drawRectangle({
          x: slot.x,
          y: layout.pageHeightPt - slot.y - slot.height,
          width: slot.width,
          height: slot.height,
          borderColor: rgb(0.55, 0.57, 0.6),
          borderWidth: 0.8,
        });
      }

      if (plan.settings.showSlideNumbers) {
        const slideLabel = `${orderIndex + 1}`;
        const fontSize = chooseFontSize(layout.pageWidthPt) - 1;
        page.drawText(slideLabel, {
          x: slot.x + 6,
          y: contentBottom + 6,
          size: fontSize,
          font,
          color: rgb(0.25, 0.27, 0.3),
        });
      }

      if (notes.enabled) {
        const lineSpacingPt = mmToPt(notes.lineSpacingMm);
        const paddingPt = mmToPt(4);
        if (notes.position === "bottom") {
          const startY = slotBottom + mmToPt(notes.gapMm) + lineSpacingPt;
          const lineStartX = slot.x + paddingPt;
          const lineEndX = slot.x + slot.width - paddingPt;
          for (let i = 0; i < notes.lineCount; i++) {
            const yLine = startY + i * lineSpacingPt;
            page.drawLine({
              start: { x: lineStartX, y: yLine },
              end: { x: lineEndX, y: yLine },
              thickness: 0.6,
              color: rgb(0.8, 0.82, 0.85),
            });
          }
        } else {
          const areaStartX =
            notes.position === "left"
              ? slot.x + paddingPt
              : slot.x + slot.width - mmToPt(notes.notesAreaWidthMm) + paddingPt;
          const areaEndX =
            notes.position === "left"
              ? slot.x + mmToPt(notes.notesAreaWidthMm) - paddingPt
              : slot.x + slot.width - paddingPt;
          const startY = slotBottom + mmToPt(notes.gapMm) + lineSpacingPt;
          for (let i = 0; i < notes.lineCount; i++) {
            const yLine = startY + i * lineSpacingPt;
            page.drawLine({
              start: { x: areaStartX, y: yLine },
              end: { x: areaEndX, y: yLine },
              thickness: 0.6,
              color: rgb(0.8, 0.82, 0.85),
            });
          }
        }
      }

      orderIndex += 1;
    }

    if (plan.settings.showPageNumbers) {
      const label = `${outIndex + 1} / ${outputPageCount}`;
      const fontSize = chooseFontSize(layout.pageWidthPt);
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      page.drawText(label, {
        x: (layout.pageWidthPt - textWidth) / 2,
        y: 18,
        size: fontSize,
        font,
        color: rgb(0.3, 0.32, 0.36),
      });
    }

  }

  return target.save();
}

function chooseFontSize(pageWidthPt: number) {
  if (pageWidthPt >= 700) return 12;
  if (pageWidthPt >= 600) return 11;
  return 10;
}
