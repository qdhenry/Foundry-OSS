"use client";

import { useGSAP } from "@gsap/react";
import { type RefObject, useRef } from "react";
import { DUR_BASE, DUR_FAST, EASE_OUT_EXPO, EASE_SMOOTH, Flip, gsap, STAGGER_CARDS } from "./gsap";

// ─── useStaggerEntrance ──────────────────────────────────────────────
// Fade+slide children on mount. After animation, clears inline styles
// so Tailwind hover states work normally.

interface StaggerEntranceOpts {
  y?: number;
  duration?: number;
  stagger?: number;
  delay?: number;
}

export function useStaggerEntrance(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  opts: StaggerEntranceOpts = {},
) {
  const { y = 16, duration = DUR_BASE, stagger = STAGGER_CARDS, delay = 0 } = opts;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(containerRef.current?.querySelectorAll(selector), {
          opacity: 0,
          y,
          duration,
          stagger,
          delay,
          ease: EASE_OUT_EXPO,
          clearProps: "all",
        });
      });
    },
    { scope: containerRef, dependencies: [] },
  );
}

// ─── useCountUp ──────────────────────────────────────────────────────
// Animate a number from 0 to target, writing to textContent.

interface CountUpOpts {
  duration?: number;
  format?: (n: number) => string;
  delay?: number;
}

export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  target: number | undefined,
  opts: CountUpOpts = {},
) {
  const { duration = DUR_BASE + 0.3, format = (n) => String(Math.round(n)), delay = 0 } = opts;
  const prevTarget = useRef<number | undefined>(undefined);

  useGSAP(
    () => {
      if (!ref.current || target === undefined) return;
      // Skip if target hasn't changed
      if (prevTarget.current === target) return;
      prevTarget.current = target;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration,
          delay,
          ease: EASE_SMOOTH,
          onUpdate: () => {
            if (ref.current) {
              ref.current.textContent = format(obj.val);
            }
          },
        });
      });
    },
    { scope: ref, dependencies: [target] },
  );
}

// ─── useProgressBar ──────────────────────────────────────────────────
// Smooth progress bar fill. `overwrite: true` handles rapid Convex updates.

interface ProgressBarOpts {
  duration?: number;
}

export function useProgressBar(
  barRef: RefObject<HTMLElement | null>,
  percent: number | undefined,
  opts: ProgressBarOpts = {},
) {
  const { duration = DUR_BASE } = opts;

  useGSAP(
    () => {
      if (!barRef.current || percent === undefined) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(barRef.current!, {
          width: `${percent}%`,
          duration,
          ease: EASE_SMOOTH,
          overwrite: true,
        });
      });
      // Reduced motion fallback: set width directly
      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (barRef.current) {
          barRef.current.style.width = `${percent}%`;
        }
      });
    },
    { scope: barRef, dependencies: [percent] },
  );
}

// ─── useSlideReveal ──────────────────────────────────────────────────
// Animate height 0 → auto for expand/collapse panels.

interface SlideRevealOpts {
  duration?: number;
}

export function useSlideReveal(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  opts: SlideRevealOpts = {},
) {
  const { duration = DUR_BASE } = opts;
  const hasInitialized = useRef(false);

  useGSAP(
    () => {
      if (!ref.current) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!hasInitialized.current) {
          // Set initial state without animation
          gsap.set(ref.current!, {
            height: isOpen ? "auto" : 0,
            overflow: "hidden",
            opacity: isOpen ? 1 : 0,
          });
          hasInitialized.current = true;
          return;
        }

        if (isOpen) {
          gsap.to(ref.current!, {
            height: "auto",
            opacity: 1,
            duration,
            ease: EASE_SMOOTH,
            overwrite: true,
          });
        } else {
          gsap.to(ref.current!, {
            height: 0,
            opacity: 0,
            duration: duration * 0.8,
            ease: EASE_SMOOTH,
            overwrite: true,
          });
        }
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (ref.current) {
          ref.current.style.height = isOpen ? "auto" : "0";
          ref.current.style.overflow = "hidden";
          ref.current.style.opacity = isOpen ? "1" : "0";
        }
      });
    },
    { scope: ref, dependencies: [isOpen] },
  );
}

// ─── useTabIndicator ─────────────────────────────────────────────────
// Animated sliding indicator for tab bars using GSAP Flip.

export function useTabIndicator(
  indicatorRef: RefObject<HTMLElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  activeSelector: string,
) {
  useGSAP(
    () => {
      if (!indicatorRef.current || !containerRef.current) return;

      const activeEl = containerRef.current.querySelector(activeSelector) as HTMLElement | null;
      if (!activeEl) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const state = Flip.getState(indicatorRef.current!);
        // Move indicator to match active tab
        const containerRect = containerRef.current?.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();

        gsap.set(indicatorRef.current!, {
          left: activeRect.left - containerRect.left,
          width: activeRect.width,
        });

        Flip.from(state, {
          duration: DUR_FAST + 0.07,
          ease: EASE_SMOOTH,
          absolute: true,
        });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (!indicatorRef.current || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        indicatorRef.current.style.left = `${activeRect.left - containerRect.left}px`;
        indicatorRef.current.style.width = `${activeRect.width}px`;
      });
    },
    { scope: containerRef, dependencies: [activeSelector] },
  );
}

// ─── useFadeIn ───────────────────────────────────────────────────────
// Simple fade-in for content appearing after loading.

export function useFadeIn(ref: RefObject<HTMLElement | null>, isReady: boolean) {
  useGSAP(
    () => {
      if (!ref.current || !isReady) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current!, {
          opacity: 0,
          duration: DUR_BASE,
          ease: EASE_SMOOTH,
          clearProps: "opacity",
        });
      });
    },
    { scope: ref, dependencies: [isReady] },
  );
}
