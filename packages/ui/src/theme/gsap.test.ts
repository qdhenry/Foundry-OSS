import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock matchMedia before GSAP imports (ScrollTrigger calls window.matchMedia on register)
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("gsap exports", () => {
  it("exports gsap instance", async () => {
    const mod = await import("./gsap");
    expect(mod.gsap).toBeDefined();
    expect(typeof mod.gsap.to).toBe("function");
  });

  it("exports Flip plugin", async () => {
    const mod = await import("./gsap");
    expect(mod.Flip).toBeDefined();
  });

  it("exports ScrollTrigger plugin", async () => {
    const mod = await import("./gsap");
    expect(mod.ScrollTrigger).toBeDefined();
  });

  it("exports ease constants", async () => {
    const mod = await import("./gsap");
    expect(mod.EASE_OUT_EXPO).toBe("expo.out");
    expect(mod.EASE_SPRING).toBe("back.out(1.4)");
    expect(mod.EASE_SMOOTH).toBe("power2.out");
  });

  it("exports duration constants", async () => {
    const mod = await import("./gsap");
    expect(mod.DUR_FAST).toBe(0.18);
    expect(mod.DUR_BASE).toBe(0.3);
    expect(mod.DUR_SLOW).toBe(0.55);
  });

  it("exports stagger constants", async () => {
    const mod = await import("./gsap");
    expect(mod.STAGGER_CARDS).toBe(0.06);
    expect(mod.STAGGER_LIST).toBe(0.04);
  });
});
