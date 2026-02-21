import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-card text-foreground">
      <div className="container flex flex-col items-start justify-between gap-6 py-8 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="relative h-7 w-7 overflow-hidden">
            <Image
              src="/calypso-logo.png"
              alt="Calypso logo"
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <p className="text-base leading-tight">Powered by Calypso Inc.</p>
            <p className="text-sm text-muted-foreground">© 2026 Jonas. All rights reserved.</p>
          </div>
        </div>

        <div className="text-base md:text-right">
          <p className="text-sm">
            This project is open source, view it
            {" "}
            <Link
              href="https://github.com/flodlol/PDF-Slides-to-Hand-Outs"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium underline underline-offset-4 decoration-2 hover:text-primary"
            >
              here.
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
