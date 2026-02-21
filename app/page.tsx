"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { Header } from "@/components/Header";
import { UploadZone } from "@/components/UploadZone";
import { ControlsPanel } from "@/components/ControlsPanel";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TemplateSelector } from "@/components/TemplateSelector";
import { generateHandout } from "@/lib/generateHandout";
import { buildLayoutPlan } from "@/lib/layoutEngine";
import { defaultSettings, templates, downloadTemplate } from "@/lib/templates";
import { HandoutSettings, TemplatePreset } from "@/lib/types";
import { Download, Zap } from "lucide-react";
import { getCookie, setCookie } from "@/lib/cookies";
import { SlideStrip } from "@/components/SlideStrip";
import { useRef } from "react";
import { CookieBanner } from "@/components/CookieBanner";

interface LoadedPdfMeta {
  name: string;
  size: number;
}

const SELECTED_TEMPLATE_KEY = "phs-selected-template";

export default function HomePage() {
  const [settings, setSettings] = useState<HandoutSettings>(defaultSettings);
  const [currentTemplate, setCurrentTemplate] = useState<string | undefined>();
  const [customTemplates, setCustomTemplates] = useState<TemplatePreset[]>([]);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [meta, setMeta] = useState<LoadedPdfMeta | null>(null);
  const [currentOutputPage, setCurrentOutputPage] = useState(0);
  const previewZoom = 0.5;
  const presetUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("phs-settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as HandoutSettings;
        setSettings(parsed);
      } catch (err) {
        console.warn("Failed to parse stored settings", err);
      }
    }

    const storedCustom = localStorage.getItem("phs-custom-templates");
    if (storedCustom) {
      try {
        const parsed = JSON.parse(storedCustom) as TemplatePreset[];
        setCustomTemplates(parsed);
      } catch (err) {
        console.warn("Failed to parse stored custom templates", err);
      }
    }

    const selected = localStorage.getItem(SELECTED_TEMPLATE_KEY);
    const cookiePreset = getCookie("phs-default-preset");
    const templateId = selected || cookiePreset;
    if (templateId) setCurrentTemplate(templateId);
  }, []);

  useEffect(() => {
    localStorage.setItem("phs-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("phs-custom-templates", JSON.stringify(customTemplates));
  }, [customTemplates]);

  const layout = useMemo(() => buildLayoutPlan(settings), [settings]);

  const handleUpload = useCallback(async (file: File) => {
    setIsParsing(true);
    setMeta({ name: file.name.replace(/\.pdf$/i, ""), size: file.size });
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    setPdfBytes(bytes);
    try {
      const { loadPdfFromBytes } = await import("@/lib/pdfClient");
      const pdf = await loadPdfFromBytes(bytes);
      setPdfDoc(pdf);
      setPageCount(pdf.numPages);
      setSelectedPages(Array.from({ length: pdf.numPages }, (_, i) => i));
      setCurrentOutputPage(0);
    } catch (err) {
      console.error("Failed to load PDF", err);
      alert("Sorry, this PDF could not be loaded. Please try another file.");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleTemplate = useCallback((tpl: TemplatePreset) => {
    setSettings(tpl.settings);
    setCurrentTemplate(tpl.id);
    setCookie("phs-default-preset", tpl.id, 365);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SELECTED_TEMPLATE_KEY, tpl.id);
    }
  }, []);

  const handleSettingsChange = useCallback((patch: Partial<HandoutSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    setCurrentTemplate(undefined);
    setSelectedPages((prev) => prev);
  }, []);

  const handleDownload = useCallback(async () => {
    setIsGenerating(true);
    try {
      const sourceBytes = await (async () => {
        if (pdfBytes && pdfBytes.length > 4) return pdfBytes;
        if (pdfDoc) {
          const data = await pdfDoc.getData();
          return data instanceof Uint8Array ? data : new Uint8Array(data);
        }
        throw new Error("No PDF loaded");
      })();

      // Ensure we have a PDF header (%PDF)
      const hasHeader =
        sourceBytes[0] === 0x25 &&
        sourceBytes[1] === 0x50 &&
        sourceBytes[2] === 0x44 &&
        sourceBytes[3] === 0x46;
      if (!hasHeader) {
        throw new Error("Source data is not a valid PDF (missing %PDF header).");
      }

      if (selectedPages.length === 0) {
        throw new Error("No slides selected.");
      }

      const output = await generateHandout(sourceBytes, settings, selectedPages);
      const arrayBuffer =
        output.byteOffset === 0 && output.byteLength === output.buffer.byteLength
          ? (output.buffer as ArrayBuffer)
          : (output.buffer as ArrayBuffer).slice(
              output.byteOffset,
              output.byteOffset + output.byteLength
            );
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meta?.name ?? "handout"}_handout.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate handout", err);
      alert("Could not generate the handout PDF. Please re-upload the file and try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [pdfBytes, pdfDoc, settings, meta]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="container py-10">
        <Header />

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadZone
                  onFile={handleUpload}
                  fileName={meta?.name}
                  fileSize={meta?.size}
                  isLoading={isParsing}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Layout & Styling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <ControlsPanel
                    settings={settings}
                    onChange={handleSettingsChange}
                    onReset={handleReset}
                  />
                  <Accordion type="single" collapsible>
                    <AccordionItem value="templates">
                      <AccordionTrigger>Quick templates</AccordionTrigger>
                      <AccordionContent>
                        <TemplateSelector
                          templates={[...templates, ...customTemplates]}
                          onSelect={handleTemplate}
                          currentId={currentTemplate}
                          onDownload={downloadTemplate}
                        />
                        <div className="mt-4 space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const name = prompt("Template name?");
                              if (!name) return;
                              const id = name.toLowerCase().replace(/\\s+/g, "-");
                              const newTpl: TemplatePreset = {
                                id,
                                name,
                                description: "Custom preset",
                                settings,
                              };
                              setCustomTemplates((prev) => [...prev, newTpl]);
                              handleTemplate(newTpl);
                            }}
                          >
                            Save current settings as template
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => presetUploadRef.current?.click()}
                          >
                            Upload preset (JSON)
                          </Button>
                          <input
                            ref={presetUploadRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const text = await file.text();
                                const tpl = JSON.parse(text) as TemplatePreset;
                                if (!tpl?.id || !tpl?.settings) {
                                  alert("Invalid preset file");
                                  return;
                                }
                                setCustomTemplates((prev) => {
                                  const filtered = prev.filter((p) => p.id !== tpl.id);
                                  return [...filtered, tpl];
                                });
                                handleTemplate(tpl);
                              } catch (err) {
                                alert("Could not parse preset JSON");
                              } finally {
                                e.target.value = "";
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCookie("phs-default-preset", "", -1);
                              setCurrentTemplate(undefined);
                              if (typeof localStorage !== "undefined") {
                                localStorage.removeItem(SELECTED_TEMPLATE_KEY);
                              }
                            }}
                          >
                            Clear default preset cookie
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Generates a new PDF on your device. Vector quality preserved where possible.
                  </p>
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    disabled={!pdfBytes || isGenerating}
                    onClick={handleDownload}
                  >
                    {isGenerating ? <Zap className="h-4 w-4 animate-pulse" /> : <Download className="h-4 w-4" />}
                    {isGenerating ? "Building PDF…" : "Download handout"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="lg:h-[calc(100vh-160px)] shadow-none border-0 bg-transparent relative z-0 mb-10">
              <CardHeader className="flex items-center justify-between space-y-0">
                <CardTitle>Live Preview</CardTitle>
                <span className="text-sm text-muted-foreground">Client-side • Instant</span>
              </CardHeader>
              <CardContent className="h-full overflow-auto pb-8">
                {!pdfDoc ? (
                  <div className="flex h-full min-h-[400px] items-center justify-center text-muted-foreground">
                    Upload a PDF to see the preview.
                  </div>
                ) : (
                  <PreviewCanvas
                    pdf={pdfDoc}
                    layout={layout}
                    settings={settings}
                    pageCount={pageCount}
                    selectedPages={selectedPages}
                    currentOutputPage={currentOutputPage}
                    onPageChange={setCurrentOutputPage}
                    zoom={previewZoom}
                  />
                )}
              </CardContent>
            </Card>

            {pdfDoc && (
              <Card className="shadow-none border border-border/60 bg-card relative w-full mt-12">
                <CardHeader>
                  <CardTitle>Slide picker</CardTitle>
                </CardHeader>
                <CardContent>
                  <SlideStrip
                    pdf={pdfDoc}
                    selectedPages={selectedPages}
                    onToggle={(pageIndex) => {
                      setSelectedPages((prev) =>
                        prev.includes(pageIndex)
                          ? prev.filter((p) => p !== pageIndex)
                          : [...prev, pageIndex].sort((a, b) => a - b)
                      );
                    }}
                    onSelectAll={() =>
                      setSelectedPages(Array.from({ length: pageCount }, (_, i) => i))
                    }
                    onDeselectAll={() => setSelectedPages([])}
                    maxWidth={layout.pageWidthPx * previewZoom + 160}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <CookieBanner />
    </main>
  );
}
