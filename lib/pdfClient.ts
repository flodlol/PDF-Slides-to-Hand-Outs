"use client";

import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;
let workerSrcPromise: Promise<string> | null = null;

async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist");
  }
  return pdfjsLibPromise;
}

async function ensureWorker() {
  if (typeof window === "undefined") return;
  if (!workerSrcPromise) {
    workerSrcPromise = import("pdfjs-dist/build/pdf.worker.min.js?url").then((mod: any) => {
      return mod?.default || mod;
    });
  }
  const workerSrc = await workerSrcPromise;
  const pdfjs = await getPdfJs();
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
}

export async function loadPdfFromBytes(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  await ensureWorker();
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false });
  return loadingTask.promise;
}
