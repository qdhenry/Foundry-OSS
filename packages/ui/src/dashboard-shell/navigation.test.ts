import { describe, expect, it } from "vitest";
import { getNavigation, type NavigationState } from "./navigation";

const EMPTY_STATE: NavigationState = {
  discoveryPending: 0,
  requirementsTotal: 0,
  requirementsUnassigned: 0,
  workstreamsCount: 0,
  sprintsActive: 0,
  sprintsPlanning: 0,
  tasksTotal: 0,
  tasksInProgress: 0,
  skillsCount: 0,
  risksCount: 0,
  gatesCount: 0,
  designAssetsTotal: 0,
};

function stateWith(overrides: Partial<NavigationState> = {}): NavigationState {
  return { ...EMPTY_STATE, ...overrides };
}

describe("getNavigation", () => {
  it("returns correct section groups when programId is provided", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const titles = nav.map((s) => s.title);
    expect(titles).toEqual([
      "Main",
      "Plan",
      "Design",
      "Build",
      "Knowledge",
      "Utilities",
      "Activity",
    ]);
  });

  it("Plan section contains Discovery, Requirements, and Workstreams", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const plan = nav.find((s) => s.title === "Plan")!;
    const labels = plan.items.map((i) => i.label);
    expect(labels).toEqual(["Discovery", "Requirements", "Workstreams"]);
  });

  it("Build section contains Sprints and Tasks", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const build = nav.find((s) => s.title === "Build")!;
    const labels = build.items.map((i) => i.label);
    expect(labels).toEqual(["Sprints", "Tasks"]);
  });

  it("does not include Documents or Videos entries", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const allLabels = nav.flatMap((s) => s.items.map((i) => i.label));
    expect(allLabels).not.toContain("Documents");
    expect(allLabels).not.toContain("Videos");
  });

  it("returns readiness='empty' when count is 0", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const requirements = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Requirements")!;
    expect(requirements.readiness).toBe("empty");
  });

  it("returns readiness='ready' when count > 0", () => {
    const nav = getNavigation("prog-1", stateWith({ requirementsTotal: 10 }));
    const requirements = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Requirements")!;
    expect(requirements.readiness).toBe("ready");
  });

  it("returns readiness='active' for Discovery with pending findings", () => {
    const nav = getNavigation("prog-1", stateWith({ discoveryPending: 5 }));
    const discovery = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Discovery")!;
    expect(discovery.readiness).toBe("active");
  });

  it("computes badgeLabel correctly for items with counts", () => {
    const state = stateWith({
      discoveryPending: 3,
      requirementsTotal: 15,
      workstreamsCount: 4,
      skillsCount: 8,
      tasksTotal: 20,
      sprintsActive: 2,
    });
    const nav = getNavigation("prog-1", state);

    const discovery = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Discovery")!;
    expect(discovery.badgeLabel).toBe("3 pending");
    expect(discovery.badge).toBe(3);

    const requirements = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Requirements")!;
    expect(requirements.badgeLabel).toBe("15");

    const workstreams = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Workstreams")!;
    expect(workstreams.badgeLabel).toBe("4");

    const sprints = nav.find((s) => s.title === "Build")?.items.find((i) => i.label === "Sprints")!;
    expect(sprints.badgeLabel).toBe("2 active");

    const tasks = nav.find((s) => s.title === "Build")?.items.find((i) => i.label === "Tasks")!;
    expect(tasks.badgeLabel).toBe("20");

    const skills = nav
      .find((s) => s.title === "Knowledge")
      ?.items.find((i) => i.label === "Skills")!;
    expect(skills.badgeLabel).toBe("8");
  });

  it("returns no badgeLabel when counts are 0", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const requirements = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Requirements")!;
    expect(requirements.badgeLabel).toBeUndefined();
  });

  it("returns minimal nav with hash hrefs when programId is null", () => {
    const nav = getNavigation(null, EMPTY_STATE);
    const plan = nav.find((s) => s.title === "Plan")!;
    for (const item of plan.items) {
      expect(item.href).toBe("#");
      expect(item.readiness).toBe("empty");
    }

    const build = nav.find((s) => s.title === "Build")!;
    for (const item of build.items) {
      expect(item.href).toBe("#");
      expect(item.readiness).toBe("empty");
    }
  });

  it("generates correct hrefs for program-scoped items", () => {
    const nav = getNavigation("prog-1", EMPTY_STATE);
    const discovery = nav
      .find((s) => s.title === "Plan")
      ?.items.find((i) => i.label === "Discovery")!;
    expect(discovery.href).toBe("/prog-1/discovery");

    const tasks = nav.find((s) => s.title === "Build")?.items.find((i) => i.label === "Tasks")!;
    expect(tasks.href).toBe("/prog-1/tasks");
  });
});
