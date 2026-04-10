"use client";

import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, Flip);

// Eases
export const EASE_OUT_EXPO = "expo.out";
export const EASE_SPRING = "back.out(1.4)";
export const EASE_SMOOTH = "power2.out";

// Durations (seconds)
export const DUR_FAST = 0.18;
export const DUR_BASE = 0.3;
export const DUR_SLOW = 0.55;

// Stagger presets
export const STAGGER_CARDS = 0.06;
export const STAGGER_LIST = 0.04;

export { Flip, gsap, ScrollTrigger };
