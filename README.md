# PDF Handout Studio

Fast, fully client-side Next.js 14 app to turn any PDF into polished N-up handout PDFs with live preview.

## Features
- Upload a PDF (drag & drop), parsed instantly in the browser.
- Configure pages-per-sheet, orientation, margins, spacing, scale, frame, and page numbers.
- One-click templates for common layouts.
- Live canvas preview using pdf.js with zoom and paging.
- Export new PDF using pdf-lib, preserving vector quality — runs entirely client-side.
- Light/dark theme with system follow and persistence.
- Vercel-ready; no server processing required.

## Stack
- Next.js 14 (App Router), React 18, TypeScript
- TailwindCSS + shadcn/ui primitives
- pdf-lib for generation
- pdfjs-dist for preview rendering
- next-themes for theming



## File Structure
- `app/` – App Router entry points (`layout.tsx`, `page.tsx`).
- `components/` – UI building blocks and feature components.
- `lib/` – Core logic: layout engine, handout generator, templates, types, pdf.js loader.
- `styles/globals.css` – Tailwind base and theme tokens.

## Notes
- All processing stays in-browser; PDFs are never uploaded.
- pdf.js worker is lazy-loaded when needed.
- Settings persist in localStorage.
