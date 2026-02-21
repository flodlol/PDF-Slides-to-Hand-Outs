"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { useDropzone } from "react-dropzone";
import { FileDown, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFile: (file: File) => void;
  fileName?: string;
  fileSize?: number;
  isLoading?: boolean;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadZone({ onFile, fileName, fileSize, isLoading }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const accept = useMemo(() => ({ "application/pdf": [".pdf"] }), []);

  const handleAccept = useCallback(
    (accepted: File[]) => {
      const pdf = accepted[0];
      if (!pdf) return;
      setError(null);
      onFile(pdf);
    },
    [onFile]
  );

  const handleReject = useCallback(() => {
    setError("Please drop a PDF file (.pdf).");
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept,
    multiple: false,
    maxFiles: 1,
    noKeyboard: true,
    onDropAccepted: handleAccept,
    onDropRejected: handleReject,
  });

  const handleBrowse = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      open();
    },
    [open]
  );

  return (
    <div
      className={cn(
        "group flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/40 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-muted",
        isDragActive && "border-primary/80 bg-primary/5",
        fileName && "border-dashed border-border"
      )}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {fileName ? <FileDown /> : <Upload />}
      </div>
      <p className="mt-3 text-base font-semibold">
        {fileName ? "PDF loaded" : "Drop your PDF or click to upload"}
      </p>
      <p className="text-sm text-muted-foreground">
        {fileName ? `${fileName} • ${formatSize(fileSize)}` : "Only .pdf files are accepted"}
      </p>
      {isLoading && <p className="mt-2 text-xs text-muted-foreground">Parsing PDF…</p>}
      {error && (
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      <div className="mt-4">
        <Button variant="secondary" size="sm" type="button" onClick={handleBrowse}>
          Browse
        </Button>
      </div>
    </div>
  );
}
