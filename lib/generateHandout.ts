import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildLayoutPlan } from "./layoutEngine";
import { HandoutSettings } from "./types";

/**
 * Generate an N-up handout PDF based on incoming PDF bytes and layout settings.
 */
export async function generateHandout(
  inputPdfBytes: Uint8Array,
  settings: HandoutSettings
): Promise<Uint8Array> {
  if (!inputPdfBytes || inputPdfBytes.length < 4) {
    throw new Error("Input PDF bytes are empty.");
  }

  const src = await PDFDocument.load(inputPdfBytes, { ignoreEncryption: true });
  const target = await PDFDocument.create();
  const font = await target.embedFont(StandardFonts.Helvetica);
  const layout = buildLayoutPlan(settings);

  const pagesPerSheet = settings.pagesPerSheet;
  const totalPages = src.getPageCount();
  const outputPageCount = Math.ceil(totalPages / pagesPerSheet);
  const contentScale = settings.scale / 100;

  let cursor = 0;
  for (let outIndex = 0; outIndex < outputPageCount; outIndex++) {
    const page = target.addPage([layout.pageWidthPt, layout.pageHeightPt]);

    for (let slotIndex = 0; slotIndex < layout.slotsPt.length; slotIndex++) {
      const inputIndex = cursor + slotIndex;
      if (inputIndex >= totalPages) break;

      const sourcePage = src.getPage(inputIndex);
      const embedded = await target.embedPage(sourcePage);
      const slot = layout.slotsPt[slotIndex];

      const fit = Math.min(slot.width / embedded.width, slot.height / embedded.height);
      const renderScale = fit * contentScale;
      const renderWidth = embedded.width * renderScale;
      const renderHeight = embedded.height * renderScale;

      const x = slot.x + (slot.width - renderWidth) / 2;
      // PDF-lib's origin is bottom-left; convert from top-based slot y
      const y = layout.pageHeightPt - slot.y - slot.height + (slot.height - renderHeight) / 2;

      page.drawPage(embedded, {
        x,
        y,
        xScale: renderScale,
        yScale: renderScale,
      });

      if (settings.showFrame) {
        page.drawRectangle({
          x: slot.x,
          y: layout.pageHeightPt - slot.y - slot.height,
          width: slot.width,
          height: slot.height,
          borderColor: rgb(0.55, 0.57, 0.6),
          borderWidth: 0.8,
        });
      }

      if (settings.showSlideNumbers) {
        const slideLabel = `${inputIndex + 1}`;
        const fontSize = chooseFontSize(layout.pageWidthPt) - 1;
        page.drawText(slideLabel, {
          x: slot.x + 6,
          y: layout.pageHeightPt - slot.y - fontSize - 6,
          size: fontSize,
          font,
          color: rgb(0.25, 0.27, 0.3),
        });
      }
    }

    if (settings.showPageNumbers) {
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

    cursor += pagesPerSheet;
  }

  return target.save();
}

function chooseFontSize(pageWidthPt: number) {
  if (pageWidthPt >= 700) return 12;
  if (pageWidthPt >= 600) return 11;
  return 10;
}
