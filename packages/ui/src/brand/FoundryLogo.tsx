"use client";

import { useEffect, useState } from "react";
import { FoundryMark } from "./FoundryMark";

type Variant = "auto" | "dark" | "light" | "slate" | "mono-white" | "mono-black" | "flat";
type MarkVariant = Exclude<Variant, "auto">;

interface FoundryLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: Variant;
  className?: string;
}

const SIZES = {
  sm: { mark: 20, text: "text-xs" },
  md: { mark: 30, text: "text-[15px]" },
  lg: { mark: 40, text: "text-lg" },
} as const;

const TEXT_COLORS: Record<Variant, string | undefined> = {
  auto: undefined,
  dark: "#93afd0",
  light: "#1e293b",
  slate: "#1e293b",
  "mono-white": "#d0d0d0",
  "mono-black": "#333",
  flat: "#3b82f6",
};

export function FoundryLogo({ size = "md", variant = "auto", className }: FoundryLogoProps) {
  const s = SIZES[size];

  const [markVariant, setMarkVariant] = useState<MarkVariant>(
    variant === "auto" ? "dark" : variant,
  );

  useEffect(() => {
    if (variant !== "auto") return;

    const root = document.documentElement;
    const update = () => setMarkVariant(root.classList.contains("dark") ? "dark" : "light");

    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [variant]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <FoundryMark size={s.mark} variant={variant === "auto" ? markVariant : variant} />
      <span
        className={`${s.text} font-semibold uppercase tracking-[0.08em] ${
          variant === "auto" ? "text-text-wordmark" : ""
        }`}
        style={{
          color: TEXT_COLORS[variant] ?? undefined,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        FOUNDRY
      </span>
    </div>
  );
}
