"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SlideStripProps {
  pdf: PDFDocumentProxy;
  selectedPages: number[];
  onToggle: (pageIndex: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  maxWidth?: number; // cap outer container width
}

export function SlideStrip({
  pdf,
  selectedPages,
  onToggle,
  onSelectAll,
  onDeselectAll,
  maxWidth,
}: SlideStripProps) {
  const [pageCount, setPageCount] = useState(0);
  const canvasRefs = useRef<HTMLCanvasElement[]>([]);
  const renderCache = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    setPageCount(pdf.numPages);
    // Kick off eager rendering of all thumbs immediately
    let cancelled = false;
    (async () => {
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1 });
        const targetWidth = 220;
        const scale = targetWidth / viewport.width;
        const thumbViewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = thumbViewport.width;
        canvas.height = thumbViewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport: thumbViewport }).promise;
        renderCache.current.set(i, canvas);
        if (cancelled) break;
        const target = canvasRefs.current[i];
        if (target) drawToTarget(canvas, target);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  function drawToTarget(src: HTMLCanvasElement, target: HTMLCanvasElement) {
    const ctx = target.getContext("2d");
    if (!ctx) return;
    target.width = src.width;
    target.height = src.height;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(src, 0, 0);
  }

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Slides ({selectedPages.length}/{pageCount})</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeselectAll}>
            Deselect all
          </Button>
        </div>
      </div>
      <div
        className="rounded-xl border border-border/60 bg-muted/50 p-4 w-full"
        style={maxWidth ? { maxWidth, margin: "0 auto" } : undefined}
      >
        <div
          className="flex w-full gap-4 overflow-x-auto overflow-y-hidden"
          style={{ minWidth: "100%" }}
        >
          {Array.from({ length: pageCount }, (_, i) => {
            const isSelected = selectedPages.includes(i);
            return (
              <div
                key={i}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-2 rounded-lg border px-3 py-3 transition cursor-pointer min-w-[240px] max-w-[280px]",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-background/70"
                )}
                onClick={() => onToggle(i)}
              >
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current[i] = el;
                  }}
                  className={cn("rounded bg-white", !isSelected && "opacity-60")}
                  style={{ width: "100%", height: "auto" }}
                />
                <span className="text-xs text-muted-foreground">Slide {i + 1}</span>
                {!isSelected && <span className="text-[10px] text-destructive">Excluded</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
