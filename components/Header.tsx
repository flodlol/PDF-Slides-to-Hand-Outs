"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";

export function Header() {
  const { setTheme, theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = theme === "system" ? systemTheme : theme;

  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image
          src="/logo/1024.png"
          alt="PDF Handout Studio logo"
          width={64}
          height={64}
          className="shrink-0"
          priority
        />
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.15em] text-primary">PDF Handout Studio</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Create polished PDF handouts in seconds.
          </h1>
        </div>
      </div>
      {mounted && (
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card px-1 py-1 shadow-subtle">
          <Button
            variant={theme === "light" ? "default" : "ghost"}
            size="icon"
            aria-label="Use light theme"
            onClick={() => setTheme("light")}
          >
            <Sun className="h-4 w-4" />
          </Button>
          <Button
            variant={theme === "system" ? "default" : "ghost"}
            size="icon"
            aria-label="Use system theme"
            onClick={() => setTheme("system")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "ghost"}
            size="icon"
            aria-label="Use dark theme"
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
