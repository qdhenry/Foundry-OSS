import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── GSAP mocks (useStaggerEntrance triggers gsap loading) ──────────────
vi.mock("gsap", () => {
  const gsapMock = {
    set: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    matchMedia: vi.fn(() => ({ add: vi.fn() })),
    registerPlugin: vi.fn(),
  };
  return { default: gsapMock };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("gsap/Flip", () => ({ Flip: { getState: vi.fn(), from: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));

import { WorkstreamsPage } from "./WorkstreamsPage";

let mockQueryResults: Record<string, unknown> = {};
const mockUpdateWorkstream = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => {
    const normalizedHref =
      typeof href === "string" ? href : typeof href?.pathname === "string" ? href.pathname : "#";

    return (
      <a href={normalizedHref} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (queryName: unknown) => {
    const key = String(queryName);
    return mockQueryResults[key] ?? undefined;
  },
  useMutation: () => mockUpdateWorkstream,
}));

describe("WorkstreamsPage", () => {
  beforeEach(() => {
    mockQueryResults = {};
    mockUpdateWorkstream.mockReset();
  });

  it("shows loading spinner when workstreams are undefined", () => {
    const { container } = render(<WorkstreamsPage programId="prog-1" programSlug="acme" />);

    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders page title and subtitle", () => {
    mockQueryResults["workstreams:listByProgram"] = [];

    render(<WorkstreamsPage programId="prog-1" programSlug="acme" />);

    expect(screen.getByText("Workstreams")).toBeInTheDocument();
    expect(screen.getByText(/Delivery tracks/)).toBeInTheDocument();
  });

  it("shows empty state when no workstreams exist", () => {
    mockQueryResults["workstreams:listByProgram"] = [];

    render(<WorkstreamsPage programId="prog-1" programSlug="acme" />);

    expect(screen.getByText("No workstreams yet")).toBeInTheDocument();
    // CTA link to requirements page
    const ctaLink = screen.getByRole("link", { name: /Create requirements first/i });
    expect(ctaLink).toHaveAttribute("href", "/acme/requirements");
  });

  it("renders workstream cards with status badges and links", () => {
    mockQueryResults["workstreams:listByProgram"] = [
      {
        _id: "ws-1",
        name: "Product Data Migration",
        shortCode: "PDM",
        status: "on_track",
      },
      {
        _id: "ws-2",
        name: "Order Processing",
        shortCode: "OP",
        status: "at_risk",
      },
    ];
    mockQueryResults["requirements:listByProgram"] = [];
    mockQueryResults["tasks:listByProgram"] = [];

    render(<WorkstreamsPage programId="prog-1" programSlug="acme" />);

    expect(screen.getByText("Product Data Migration")).toBeInTheDocument();
    expect(screen.getByText("Order Processing")).toBeInTheDocument();
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Product Data Migration/i })).toHaveAttribute(
      "href",
      "/acme/workstreams/ws-1",
    );
  });

  it("displays requirement and task stats for workstreams", () => {
    mockQueryResults["workstreams:listByProgram"] = [
      { _id: "ws-1", name: "PDM", shortCode: "PDM", status: "on_track" },
    ];
    mockQueryResults["requirements:listByProgram"] = [
      { _id: "r1", workstreamId: "ws-1" },
      { _id: "r2", workstreamId: "ws-1" },
    ];
    mockQueryResults["tasks:listByProgram"] = [
      { _id: "t1", workstreamId: "ws-1", status: "done" },
      { _id: "t2", workstreamId: "ws-1", status: "in_progress" },
    ];

    render(<WorkstreamsPage programId="prog-1" programSlug="acme" />);

    expect(screen.getByText("2 requirements")).toBeInTheDocument();
    expect(screen.getByText("1/2 tasks done")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("cycles status when status chip is clicked", async () => {
    mockQueryResults["workstreams:listByProgram"] = [
      { _id: "ws-1", name: "PDM", shortCode: "PDM", status: "on_track" },
    ];
    mockQueryResults["requirements:listByProgram"] = [];
    mockQueryResults["tasks:listByProgram"] = [];

    render(<WorkstreamsPage programId="prog-1" programSlug="acme" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /On Track/i }));

    expect(mockUpdateWorkstream).toHaveBeenCalledWith({
      workstreamId: "ws-1",
      status: "at_risk",
    });
  });
});
