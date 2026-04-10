"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useState } from "react";

interface Screenshot {
  _id: string;
  url: string | null;
  route: string;
  label: string;
  viewport: { width: number; height: number };
  order: number;
}

interface VerificationScreenshotGridProps {
  screenshots: Screenshot[];
}

export function VerificationScreenshotGrid({ screenshots }: VerificationScreenshotGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const sorted = [...screenshots].sort((a, b) => a.order - b.order);

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const next = useCallback(
    () => setLightboxIndex((i) => (i !== null && i < sorted.length - 1 ? i + 1 : i)),
    [sorted.length],
  );

  if (sorted.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Screenshots ({sorted.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sorted.map((ss, index) => (
            <button
              key={ss._id}
              onClick={() => openLightbox(index)}
              className="group relative aspect-video overflow-hidden rounded-lg border border-border-default bg-surface-raised transition-all hover:border-accent-default hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent-default"
            >
              {ss.url ? (
                <img
                  src={ss.url}
                  alt={ss.label}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-text-muted text-xs">
                  No image
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs font-medium text-white truncate">{ss.label}</p>
                <p className="text-[10px] text-white/70 font-mono">{ss.route}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && sorted[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeLightbox}
              className="absolute -right-3 -top-3 z-10 rounded-full bg-surface-elevated p-1.5 shadow-lg hover:bg-surface-overlay transition-colors"
            >
              <X className="h-4 w-4 text-text-primary" />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
            )}

            {lightboxIndex < sorted.length - 1 && (
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}

            {sorted[lightboxIndex].url && (
              <img
                src={sorted[lightboxIndex].url!}
                alt={sorted[lightboxIndex].label}
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              />
            )}

            <div className="mt-2 text-center">
              <p className="text-sm font-medium text-white">{sorted[lightboxIndex].label}</p>
              <p className="text-xs text-white/60 font-mono">{sorted[lightboxIndex].route}</p>
              <p className="text-xs text-white/40 mt-1">
                {lightboxIndex + 1} / {sorted.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
