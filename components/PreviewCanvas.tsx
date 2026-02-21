"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { LayoutPlanWithUnits, HandoutSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface PreviewCanvasProps {
  pdf: PDFDocumentProxy | null;
  layout: LayoutPlanWithUnits;
  settings: HandoutSettings;
  pageCount: number;
  currentOutputPage: number; // kept for compatibility; not used when scrolling all pages
  onPageChange: (page: number) => void;
  zoom: number;
}

export function PreviewCanvas({
  pdf,
  layout,
  settings,
  pageCount,
  currentOutputPage,
  onPageChange,
  zoom,
}: PreviewCanvasProps) {
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  const cacheRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [isRendering, setIsRendering] = useState(false);

  const outputPageCount = useMemo(
    () => Math.max(1, Math.ceil(pageCount / settings.pagesPerSheet)),
    [pageCount, settings.pagesPerSheet]
  );

  useEffect(() => {
    let cancelled = false;
    async function renderAll() {
      if (!pdf) return;
      setIsRendering(true);
      const dpr = window.devicePixelRatio || 1;
      const scaledWidth = Math.round(layout.pageWidthPx * zoom);
      const scaledHeight = Math.round(layout.pageHeightPx * zoom);

      const pages = Array.from({ length: outputPageCount }, (_, i) => i);

      for (const outIndex of pages) {
        const canvas = canvasRefs.current[outIndex];
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        canvas.style.width = `${scaledWidth}px`;
        canvas.style.height = `${scaledHeight}px`;
        canvas.width = Math.round(scaledWidth * dpr);
        canvas.height = Math.round(scaledHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, scaledWidth, scaledHeight);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, scaledWidth, scaledHeight);

        const startIndex = outIndex * settings.pagesPerSheet;
        const slots = layout.slotsPx;

        for (let i = 0; i < slots.length; i++) {
          const srcIndex = startIndex + i;
          if (srcIndex >= pageCount) break;
          const pageNumber = srcIndex + 1;

          const sourceCanvas = await renderPageToCanvas(pageNumber, pdf, cacheRef.current);
          if (cancelled) return;

          const slot = slots[i];
          const fit = Math.min(slot.width / sourceCanvas.width, slot.height / sourceCanvas.height);
          const renderScale = fit * (settings.scale / 100) * zoom;
          const renderWidth = sourceCanvas.width * renderScale;
          const renderHeight = sourceCanvas.height * renderScale;
          const x = slot.x * zoom + (slot.width * zoom - renderWidth) / 2;
          const y = slot.y * zoom + (slot.height * zoom - renderHeight) / 2;

          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(sourceCanvas, x, y, renderWidth, renderHeight);
          if (settings.showFrame) {
            ctx.strokeStyle = "rgba(60, 70, 90, 0.7)";
            ctx.lineWidth = Math.max(1, 1.2 * zoom);
            ctx.strokeRect(slot.x * zoom, slot.y * zoom, slot.width * zoom, slot.height * zoom);
          }
          ctx.restore();
        }

        if (settings.showPageNumbers) {
          ctx.fillStyle = "rgba(110,120,140,0.9)";
          ctx.font = `${12 * zoom}px 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system`;
          const label = `${outIndex + 1} / ${outputPageCount}`;
          const textWidth = ctx.measureText(label).width;
          ctx.fillText(label, (scaledWidth - textWidth) / 2, scaledHeight - 12 * zoom);
        }

        if (settings.showSlideNumbers) {
          ctx.fillStyle = "rgba(70,80,95,0.9)";
          ctx.font = `${11 * zoom}px 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system`;
          const startIndex = outIndex * settings.pagesPerSheet;
          slots.forEach((slot, i) => {
            const srcIndex = startIndex + i;
            if (srcIndex >= pageCount) return;
            const label = `${srcIndex + 1}`;
            const x = slot.x * zoom + 6 * zoom;
            const y = slot.y * zoom + slot.height * zoom - 8 * zoom;
            ctx.fillText(label, x, y);
          });
        }
      }
      setIsRendering(false);
    }

    const handle = window.setTimeout(() => {
      void renderAll();
    }, 90);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [pdf, layout, settings, pageCount, zoom, outputPageCount]);

  return (
    <div className="flex flex-col space-y-3 h-full">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page 1 - {outputPageCount}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        className="relative w-full h-full max-h-[75vh] overflow-y-auto overflow-x-hidden rounded-xl border border-border/60 bg-background p-6"
        style={{ isolation: "isolate" }}
      >
        <div className="flex flex-col items-center gap-10 pb-8">
          {Array.from({ length: outputPageCount }, (_, i) => (
            <div key={i} className="flex justify-center w-full">
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current[i] = el;
                }}
                className="rounded-lg transition bg-white border border-border/60"
                style={{ maxWidth: "100%", display: "block" }}
              />
            </div>
          ))}
        </div>
        {isRendering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

async function renderPageToCanvas(
  pageNumber: number,
  pdf: PDFDocumentProxy,
  cache: Map<number, HTMLCanvasElement>
) {
  const cached = cache.get(pageNumber);
  if (cached) return cached;

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.3 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  if (!context) return canvas;
  await page.render({ canvasContext: context, viewport }).promise;
  cache.set(pageNumber, canvas);
  return canvas;
}
