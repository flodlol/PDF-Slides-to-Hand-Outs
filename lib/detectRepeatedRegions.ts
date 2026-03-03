import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

/**
 * A region on a slide defined as fractions (0–1) of page width/height.
 */
export interface WhiteoutRegion {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

/**
 * Per-page map: pageIndex (0-based) → regions to white-out on that page.
 * Pages without the element are simply absent from the map.
 */
export type WhiteoutMap = Record<number, WhiteoutRegion[]>;

/* ── Config ────────────────────────────────────────────────── */
const DETECTION_WIDTH = 200; // px – thumbnail resolution for analysis
const CHANNEL_THRESHOLD = 35; // max per-channel diff to count a pixel as "same"
const BACKGROUND_THRESHOLD = 240; // channels above this → white background (skip)
const MAJORITY_RATIO = 0.55; // 55%+ of pages must agree for a pixel to count
const ROW_DENSITY_THRESHOLD = 0.25; // 25% of a row's pixels must be repeated → "active row"
const MIN_BAND_HEIGHT_PCT = 0.015; // bands shorter than 1.5% of page are noise
const BAND_GAP_TOLERANCE = 3; // px – gap between active rows to still merge
const REGION_PADDING_PCT = 0.006; // vertical padding added to each region (0.6%)
const PAGE_PRESENCE_THRESHOLD = 0.12; // 12% of pixels in region must be non-bg to count as "present"

/* ── Render helper ─────────────────────────────────────────── */
async function renderPageSmall(
  pdf: PDFDocumentProxy,
  pageNumber: number, // 1-based
  targetWidth: number
): Promise<ImageData> {
  const page = await pdf.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  const scale = targetWidth / vp.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/* ── Main detection ────────────────────────────────────────── */
/**
 * Detects elements that repeat on every slide (headers, footers, logos)
 * and returns regions to white-out.
 *
 * Strategy:
 * 1. Render all pages at thumbnail resolution.
 * 2. Mark pixels that are near-identical across ALL pages and aren't plain
 *    white background → "repeated pixel mask".
 * 3. For each row, compute the density of repeated pixels.
 *    Rows with density ≥ threshold form "active rows".
 * 4. Merge contiguous active rows into horizontal bands → whiteout regions
 *    that span the full page width.
 * 5. Also detect isolated repeated blobs (logos) via connected-component
 *    analysis on the mask for non-band regions.
 */
export async function detectRepeatedRegions(
  pdf: PDFDocumentProxy,
  pageIndices: number[], // 0-based
  options?: {
    channelThreshold?: number;
    backgroundThreshold?: number;
  }
): Promise<WhiteoutMap> {
  if (pageIndices.length < 2) return {};

  const channelThreshold = options?.channelThreshold ?? CHANNEL_THRESHOLD;
  const backgroundThreshold = options?.backgroundThreshold ?? BACKGROUND_THRESHOLD;

  // 1. Render all pages at thumbnail resolution
  const imageDataList: ImageData[] = [];
  for (const idx of pageIndices) {
    imageDataList.push(await renderPageSmall(pdf, idx + 1, DETECTION_WIDTH));
  }

  const width = imageDataList[0].width;
  const height = imageDataList[0].height;
  const totalPixels = width * height;
  const n = imageDataList.length;
  const minAgree = Math.max(2, Math.ceil(n * MAJORITY_RATIO));

  // 2. Build binary mask – 1 = "repeated non-background pixel"
  //    A pixel counts as "repeated" if a majority of pages share the same
  //    color at that position (within channelThreshold). This allows title
  //    slides or other outliers that don't have the element.
  const mask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const di = i * 4;

    // Collect per-page RGB at this pixel
    const colors: [number, number, number][] = [];
    for (const imgData of imageDataList) {
      colors.push([
        imgData.data[di],
        imgData.data[di + 1],
        imgData.data[di + 2],
      ]);
    }

    // Find the largest cluster of pages that agree on color
    const bestCluster = findLargestCluster(colors, channelThreshold);

    if (bestCluster.count >= minAgree) {
      // Check it's not just white background
      const avgR = bestCluster.sumR / bestCluster.count;
      const avgG = bestCluster.sumG / bestCluster.count;
      const avgB = bestCluster.sumB / bestCluster.count;
      if (
        avgR < backgroundThreshold ||
        avgG < backgroundThreshold ||
        avgB < backgroundThreshold
      ) {
        mask[i] = 1;
      }
    }
  }

  // 3. Row density analysis – find horizontal bands
  const rowDensity = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 1) count++;
    }
    rowDensity[y] = count / width;
  }

  // 4. Find contiguous bands of active rows (with small gap tolerance)
  const bands: { startY: number; endY: number }[] = [];
  let bandStart = -1;
  let gapCount = 0;

  for (let y = 0; y < height; y++) {
    if (rowDensity[y] >= ROW_DENSITY_THRESHOLD) {
      if (bandStart === -1) {
        bandStart = y;
      }
      gapCount = 0;
    } else {
      if (bandStart !== -1) {
        gapCount++;
        if (gapCount > BAND_GAP_TOLERANCE) {
          const endY = y - gapCount;
          bands.push({ startY: bandStart, endY });
          bandStart = -1;
          gapCount = 0;
        }
      }
    }
  }
  if (bandStart !== -1) {
    bands.push({ startY: bandStart, endY: height - 1 });
  }

  // 5. Convert bands to full-width whiteout regions (filter tiny bands)
  const rawRegions: WhiteoutRegion[] = [];
  const minBandHeightPx = height * MIN_BAND_HEIGHT_PCT;

  for (const band of bands) {
    const bandHeight = band.endY - band.startY + 1;
    if (bandHeight < minBandHeightPx) continue;

    // Find the actual horizontal extent: leftmost and rightmost repeated pixel in band
    let leftX = width;
    let rightX = 0;
    for (let y = band.startY; y <= band.endY; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] === 1) {
          if (x < leftX) leftX = x;
          if (x > rightX) rightX = x;
        }
      }
    }

    // If the repeated pixels span more than 40% of width, make it full-width
    // (this catches footer/header bars with varying text in the middle)
    const spanPct = (rightX - leftX + 1) / width;
    if (spanPct > 0.4) {
      leftX = 0;
      rightX = width - 1;
    }

    // Add vertical padding to ensure full coverage (catches thin border lines)
    const padPx = Math.ceil(height * REGION_PADDING_PCT);
    const paddedStartY = Math.max(0, band.startY - padPx);
    const paddedEndY = Math.min(height - 1, band.endY + padPx);
    const paddedHeight = paddedEndY - paddedStartY + 1;

    rawRegions.push({
      xPct: leftX / width,
      yPct: paddedStartY / height,
      widthPct: (rightX - leftX + 1) / width,
      heightPct: paddedHeight / height,
    });
  }

  // 6. Also detect isolated repeated blobs outside of band regions
  //    (e.g. a logo in a corner that isn't part of a full-width bar)
  const inBand = new Uint8Array(height);
  for (const band of bands) {
    for (let y = band.startY; y <= band.endY; y++) {
      inBand[y] = 1;
    }
  }

  // Light erosion on mask for blob detection
  const eroded = erode(mask, width, height);
  const visited = new Uint8Array(totalPixels);

  for (let y = 0; y < height; y++) {
    if (inBand[y] === 1) continue; // skip band rows
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (eroded[idx] === 1 && visited[idx] === 0) {
        const comp = floodFill(eroded, visited, width, height, x, y);
        if (comp.area >= totalPixels * 0.003) {
          const padPx = Math.ceil(height * REGION_PADDING_PCT);
          rawRegions.push({
            xPct: comp.minX / width,
            yPct: Math.max(0, comp.minY - padPx) / height,
            widthPct: (comp.maxX - comp.minX + 1) / width,
            heightPct: (Math.min(height - 1, comp.maxY + padPx) - Math.max(0, comp.minY - padPx) + 1) / height,
          });
        }
      }
    }
  }

  // 7. Merge overlapping regions
  const mergedRegions = mergeRegions(rawRegions);

  // 8. Build a "reference fingerprint" for each region: the median color at
  //    each pixel across all pages. This represents what the repeated element
  //    actually looks like.
  const regionFingerprints = mergedRegions.map((region) =>
    buildRegionFingerprint(region, imageDataList, width, height)
  );

  // 9. Per-page presence check: compare each page's region against the
  //    reference fingerprint. Only apply whiteout if they match closely enough.
  const result: WhiteoutMap = {};

  for (let pi = 0; pi < pageIndices.length; pi++) {
    const pageIdx = pageIndices[pi];
    const imgData = imageDataList[pi];
    const pageRegions: WhiteoutRegion[] = [];

    for (let ri = 0; ri < mergedRegions.length; ri++) {
      const region = mergedRegions[ri];
      const fingerprint = regionFingerprints[ri];
      if (doesPageMatchFingerprint(imgData, width, height, region, fingerprint, channelThreshold)) {
        pageRegions.push(region);
      }
    }

    if (pageRegions.length > 0) {
      result[pageIdx] = pageRegions;
    }
  }

  return result;
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Build a "fingerprint" for a region: the median RGB at each sampled pixel
 * across all pages. This represents what the repeated element looks like.
 */
function buildRegionFingerprint(
  region: WhiteoutRegion,
  imageDataList: ImageData[],
  imgWidth: number,
  imgHeight: number
): Uint8Array {
  const startX = Math.floor(region.xPct * imgWidth);
  const startY = Math.floor(region.yPct * imgHeight);
  const endX = Math.min(imgWidth - 1, Math.ceil((region.xPct + region.widthPct) * imgWidth));
  const endY = Math.min(imgHeight - 1, Math.ceil((region.yPct + region.heightPct) * imgHeight));
  const rw = endX - startX + 1;
  const rh = endY - startY + 1;
  const n = imageDataList.length;

  // For each pixel in the region, store median R, G, B
  const fingerprint = new Uint8Array(rw * rh * 3);

  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      const imgX = startX + rx;
      const imgY = startY + ry;
      const di = (imgY * imgWidth + imgX) * 4;

      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (const imgData of imageDataList) {
        rs.push(imgData.data[di]);
        gs.push(imgData.data[di + 1]);
        bs.push(imgData.data[di + 2]);
      }
      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);
      const mid = Math.floor(n / 2);
      const fi = (ry * rw + rx) * 3;
      fingerprint[fi] = rs[mid];
      fingerprint[fi + 1] = gs[mid];
      fingerprint[fi + 2] = bs[mid];
    }
  }

  return fingerprint;
}

/**
 * Check if a page's content in a region matches the reference fingerprint.
 * We sample pixels and compute the fraction that are close to the fingerprint.
 * If ≥ 40% of sampled pixels match, the element is present on this page.
 * A title slide with different background will have very few matches.
 */
function doesPageMatchFingerprint(
  imgData: ImageData,
  imgWidth: number,
  imgHeight: number,
  region: WhiteoutRegion,
  fingerprint: Uint8Array,
  threshold: number
): boolean {
  const startX = Math.floor(region.xPct * imgWidth);
  const startY = Math.floor(region.yPct * imgHeight);
  const endX = Math.min(imgWidth - 1, Math.ceil((region.xPct + region.widthPct) * imgWidth));
  const endY = Math.min(imgHeight - 1, Math.ceil((region.yPct + region.heightPct) * imgHeight));
  const rw = endX - startX + 1;
  const rh = endY - startY + 1;

  // Sample every Nth pixel for speed (full scan not needed)
  const step = Math.max(1, Math.floor(Math.sqrt(rw * rh) / 15));
  let matches = 0;
  let total = 0;

  for (let ry = 0; ry < rh; ry += step) {
    for (let rx = 0; rx < rw; rx += step) {
      const imgX = startX + rx;
      const imgY = startY + ry;
      const di = (imgY * imgWidth + imgX) * 4;
      const fi = (ry * rw + rx) * 3;

      const dr = Math.abs(imgData.data[di] - fingerprint[fi]);
      const dg = Math.abs(imgData.data[di + 1] - fingerprint[fi + 1]);
      const db = Math.abs(imgData.data[di + 2] - fingerprint[fi + 2]);

      total++;
      if (dr < threshold && dg < threshold && db < threshold) {
        matches++;
      }
    }
  }

  // Need ≥ 40% pixel match to consider element present
  return total > 0 && matches / total >= 0.40;
}

/**
 * Given per-page RGB colors at a single pixel, finds the largest group of
 * pages whose colors are all within `threshold` of each other.
 * Uses the median color as seed and counts how many pages match.
 */
function findLargestCluster(
  colors: [number, number, number][],
  threshold: number
): { count: number; sumR: number; sumG: number; sumB: number } {
  const n = colors.length;
  if (n === 0) return { count: 0, sumR: 0, sumG: 0, sumB: 0 };

  // Use median of each channel as the reference color (robust to outliers)
  const rs = colors.map((c) => c[0]).sort((a, b) => a - b);
  const gs = colors.map((c) => c[1]).sort((a, b) => a - b);
  const bs = colors.map((c) => c[2]).sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const refR = rs[mid];
  const refG = gs[mid];
  const refB = bs[mid];

  let count = 0;
  let sumR = 0, sumG = 0, sumB = 0;
  for (const [r, g, b] of colors) {
    if (
      Math.abs(r - refR) < threshold &&
      Math.abs(g - refG) < threshold &&
      Math.abs(b - refB) < threshold
    ) {
      count++;
      sumR += r;
      sumG += g;
      sumB += b;
    }
  }

  return { count, sumR, sumG, sumB };
}

function erode(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (
        mask[i] === 1 &&
        mask[i - 1] === 1 &&
        mask[i + 1] === 1 &&
        mask[i - w] === 1 &&
        mask[i + w] === 1
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

interface ComponentInfo {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

function floodFill(
  mask: Uint8Array,
  visited: Uint8Array,
  w: number,
  h: number,
  startX: number,
  startY: number
): ComponentInfo {
  const stack: number[] = [startX, startY];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let area = 0;

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx] === 1 || mask[idx] === 0) continue;

    visited[idx] = 1;
    area++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return { minX, minY, maxX, maxY, area };
}

function mergeRegions(regions: WhiteoutRegion[]): WhiteoutRegion[] {
  if (regions.length <= 1) return regions;
  const merged = [...regions];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        if (regionsOverlap(merged[i], merged[j])) {
          merged[i] = combineRegions(merged[i], merged[j]);
          merged.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return merged;
}

function regionsOverlap(a: WhiteoutRegion, b: WhiteoutRegion): boolean {
  const m = 0.02;
  return !(
    a.xPct + a.widthPct + m < b.xPct ||
    b.xPct + b.widthPct + m < a.xPct ||
    a.yPct + a.heightPct + m < b.yPct ||
    b.yPct + b.heightPct + m < a.yPct
  );
}

function combineRegions(a: WhiteoutRegion, b: WhiteoutRegion): WhiteoutRegion {
  const x = Math.min(a.xPct, b.xPct);
  const y = Math.min(a.yPct, b.yPct);
  const right = Math.max(a.xPct + a.widthPct, b.xPct + b.widthPct);
  const bottom = Math.max(a.yPct + a.heightPct, b.yPct + b.heightPct);
  return { xPct: x, yPct: y, widthPct: right - x, heightPct: bottom - y };
}
